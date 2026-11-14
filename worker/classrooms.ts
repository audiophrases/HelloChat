// Closed classes are saved row by row, so histories do not hit SQLite's single-value limit.
const TABLES = ['students', 'tables', 'chat', 'chat_audience', 'mutes', 'sound_off', 'stats', 'alerts', 'reports', 'blocked_words', 'blocked_tries', 'participation_checks', 'student_controls', 'chat_stars', 'private_chat', 'language_hints', 'tab_events', 'playbacks'] as const;
const SETTINGS = ['lesson', 'free', 'sound_all_off', 'secret_names', 'level', 'custom'];
type Row = Record<string, string | number | null>;
export class Classrooms {
    private sql: SqlStorage;
    private storage: DurableObjectStorage;
    constructor(sql: SqlStorage, storage: DurableObjectStorage) { this.sql = sql; this.storage = storage; }
    initialize(): void {
        this.sql.exec(`CREATE TABLE IF NOT EXISTS saved_classes (id TEXT PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS saved_rows (class_id TEXT NOT NULL, table_name TEXT NOT NULL, data TEXT NOT NULL);
            CREATE INDEX IF NOT EXISTS saved_rows_class ON saved_rows(class_id);
            INSERT OR IGNORE INTO saved_classes (id, name) VALUES ('main', 'My class');`);
    }
    current(): string { return this.sql.exec<{ value: string }>("SELECT value FROM settings WHERE key = 'active_class'").toArray()[0]?.value ?? 'main'; }
    list(): { id: string; name: string }[] { return this.sql.exec<{ id: string; name: string }>('SELECT id, name FROM saved_classes ORDER BY rowid').toArray(); }
    switchTo(id: string, name?: string): string | null {
        if (this.sql.exec("SELECT 1 FROM settings WHERE key = 'open' AND value = '1'").toArray().length) return 'Close the class before switching saved classes.';
        if (name !== undefined && (!name.trim() || name.trim().length > 60 || this.list().length >= 30)) return 'Use a name up to 60 characters. Up to 30 saved classes.';
        if (name === undefined && !this.list().some(item => item.id === id)) return 'That saved class was not found.';
        if (id === this.current()) return null;
        this.storage.transactionSync(() => {
            const current = this.current();
            this.sql.exec('DELETE FROM saved_rows WHERE class_id = ?', current);
            for (const table of TABLES) for (const row of this.sql.exec<Row>(`SELECT * FROM ${table}`).toArray())
                this.sql.exec('INSERT INTO saved_rows VALUES (?, ?, ?)', current, table, JSON.stringify(row));
            for (const key of SETTINGS) for (const row of this.sql.exec<Row>('SELECT * FROM settings WHERE key = ?', key).toArray())
                this.sql.exec('INSERT INTO saved_rows VALUES (?, ?, ?)', current, 'settings', JSON.stringify(row));
            if (name !== undefined) this.sql.exec('INSERT INTO saved_classes VALUES (?, ?)', id, name.trim());
            for (const table of TABLES) this.sql.exec(`DELETE FROM ${table}`);
            for (const key of SETTINGS) this.sql.exec('DELETE FROM settings WHERE key = ?', key);
            for (const row of this.sql.exec<{ table_name: string; data: string }>('SELECT table_name, data FROM saved_rows WHERE class_id = ?', id).toArray()) {
                if (row.table_name !== 'settings' && !TABLES.includes(row.table_name as typeof TABLES[number])) throw new Error('Invalid saved table');
                const data = JSON.parse(row.data) as Row;
                const columns = Object.keys(data);
                this.sql.exec(`INSERT INTO ${row.table_name} (${columns.map(column => `"${column.replaceAll('"', '""')}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, ...Object.values(data));
            }
            this.sql.exec('DELETE FROM tickets');
            this.sql.exec('DELETE FROM speech_budgets');
            this.sql.exec("INSERT INTO settings VALUES ('active_class', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", id);
        });
        return null;
    }
}
