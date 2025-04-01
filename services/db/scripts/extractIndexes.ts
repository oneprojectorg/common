import fs from 'fs';
import path from 'path';

const migrationsPath = path.join(process.cwd(), 'migrations');
const customMigrationsPath = path.join(process.cwd(), 'customMigrations');
const indexesFile = path.join(customMigrationsPath, '0000_CUSTOM_indexes.sql');

const sqlFiles = fs
  .readdirSync(migrationsPath)
  .filter((file: string) => file.endsWith('.sql'))
  .map((file: string) => path.join(migrationsPath, file));

for (const sqlFile of sqlFiles) {
  const sqlData = fs.readFileSync(sqlFile, 'utf8');

  // Find all CREATE INDEX statements (case insensitive)
  const indexLines = sqlData
    .split('\n')
    .filter(line => /^\s*create\s+index/i.test(line.trim()))
    .map(line => line.trim());

  if (indexLines.length > 0) {
    // Append the found CREATE INDEX statements to the custom indexes file
    fs.appendFileSync(
      indexesFile,
      `\n\n--> statement-breakpoint\n${indexLines
        .map(line => line.replace('--> statement-breakpoint', ''))
        .join('\n\n--> statement-breakpoint\n')}`,
      'utf8',
    );

    // Remove the CREATE INDEX lines from the original file
    const updatedSqlData = sqlData
      .split('\n')
      .filter(line => !indexLines.includes(line.trim()))
      .join('\n');

    fs.writeFileSync(sqlFile, updatedSqlData, 'utf8');

    console.log(
      `Extracted ${indexLines.length} index(es) from ${path.basename(sqlFile)}`,
    );
  }
}
