# CSV Runner

A Node.js command-line tool to execute commands listed in a CSV file, track their execution status, and save results for future runs.

## Features
- Accepts a CSV file as input.
- Prompts the user to select which column contains the commands to execute.
- Executes each command in the selected column.
- Tracks which commands have been executed, and their results (success, error, or not yet run).
- Saves execution results, including errors and output, to a new CSV file.
- Skips commands that have already been executed successfully in previous runs.

## Usage

1. **Install dependencies** (if any):
   ```bash
   npm install
   ```

2. **Run the script:**
   ```bash
   csv-runner path/to/your.csv
   ```

3. **Follow the prompt:**
   - The script will display the columns in your CSV and ask which one contains the commands to execute.

4. **Execution tracking:**
   - The script will create or update a results CSV (e.g., `your_results.csv`) with the following columns:
     - Original columns from your input CSV
     - `command_executed`: The command that was run
     - `state`: `success`, `error`, or `empty`
     - `output`: The output or error message from the command

5. **Re-running:**
   - If you run the script again with the same CSV, it will skip commands already marked as `success` or `error` in the results CSV, unless you choose to re-run them.

## Example CSV

| id | script              |
|----|---------------------|
| 1  | echo "Hello World"  |
| 2  | ls -l               |
| 3  | invalidcommand      |

## Example Results CSV

| id | script              | command_executed     | state    | output                |
|----|---------------------|---------------------|----------|-----------------------|
| 1  | echo "Hello World"  | echo "Hello World"  | success  | Hello World           |
| 2  | ls -l               | ls -l               | success  | ...output...          |
| 3  | invalidcommand      | invalidcommand      | error    | ...error message...   |

## Implementation Notes
- Use Node.js built-in modules and/or libraries like `csv-parser`, `csv-writer`, and `inquirer` for prompts.
- Use `child_process.exec` to run commands.
- Ensure safe execution: consider security implications of running arbitrary commands.
- Handle errors gracefully and record them in the results CSV.

## License
MIT 