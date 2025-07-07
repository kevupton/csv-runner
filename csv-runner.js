#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
// Use dynamic import for inquirer since it's an ES module
let inquirer;

class CSVRunner {
    constructor() {
        this.inputFile = null;
        this.resultsFile = null;
        this.commandColumn = null;
        this.data = [];
        this.results = [];
    }

    async run() {
        try {
            // Import inquirer dynamically
            inquirer = (await import('inquirer')).default;
            
            // Get input file from command line arguments
            this.inputFile = process.argv[2];
            
            if (!this.inputFile) {
                console.error('Usage: csv-runner <path-to-csv-file>');
                process.exit(1);
            }

            if (!fs.existsSync(this.inputFile)) {
                console.error(`File not found: ${this.inputFile}`);
                process.exit(1);
            }

            // Set up results file name
            const inputDir = path.dirname(this.inputFile);
            const inputName = path.basename(this.inputFile, path.extname(this.inputFile));
            this.resultsFile = path.join(inputDir, `${inputName}_results.csv`);

            // Load existing results if available
            await this.loadExistingResults();

            // Read and parse the input CSV
            await this.readInputCSV();

            // Select command column
            await this.selectCommandColumn();

            // Execute commands
            await this.executeCommands();

            // Save results
            await this.saveResults();

            console.log(`\n✅ Execution complete! Results saved to: ${this.resultsFile}`);

        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }

    async loadExistingResults() {
        if (fs.existsSync(this.resultsFile)) {
            return new Promise((resolve, reject) => {
                const results = [];
                fs.createReadStream(this.resultsFile)
                    .pipe(csv())
                    .on('data', (row) => results.push(row))
                    .on('end', () => {
                        this.results = results;
                        resolve();
                    })
                    .on('error', reject);
            });
        }
    }

    async readInputCSV() {
        return new Promise((resolve, reject) => {
            const data = [];
            fs.createReadStream(this.inputFile)
                .pipe(csv())
                .on('data', (row) => data.push(row))
                .on('end', () => {
                    this.data = data;
                    resolve();
                })
                .on('error', reject);
        });
    }

    async selectCommandColumn() {
        if (this.data.length === 0) {
            throw new Error('CSV file is empty or could not be parsed');
        }

        const columns = Object.keys(this.data[0]);
        
        const { selectedColumn } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedColumn',
                message: 'Select the column containing commands to execute:',
                choices: columns
            }
        ]);

        this.commandColumn = selectedColumn;
        console.log(`\nSelected column: ${this.commandColumn}`);
    }

    async executeCommands() {
        console.log('\nExecuting commands...\n');

        for (let i = 0; i < this.data.length; i++) {
            const row = this.data[i];
            const command = row[this.commandColumn];

            if (!command || command.trim() === '') {
                console.log(`Row ${i + 1}: Empty command, skipping...`);
                this.updateResult(row, '', 'empty', '');
                continue;
            }

            // Check if command was already executed successfully (don't retry successful commands)
            const existingResult = this.findExistingResult(row);
            if (existingResult && existingResult.state === 'success') {
                console.log(`Row ${i + 1}: Command already executed successfully, skipping...`);
                continue;
            }
            
            // If command was in error state, note that we're retrying
            if (existingResult && existingResult.state === 'error') {
                console.log(`Row ${i + 1}: Retrying command that previously failed...`);
            }

            console.log(`Row ${i + 1}: Executing: ${command}`);

            try {
                const result = await this.executeCommand(command);
                this.updateResult(row, command, 'success', result);
                console.log(`✅ Success`);
            } catch (error) {
                this.updateResult(row, command, 'error', error.message);
                console.log(`❌ Error: ${error.message}`);
            }
        }
    }

    executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || error.message));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    findExistingResult(row) {
        // Create a unique key based on all row data except command_executed, state, and output
        const rowKey = JSON.stringify(row);
        return this.results.find(result => {
            const resultKey = JSON.stringify(
                Object.fromEntries(
                    Object.entries(result).filter(([key]) => 
                        !['command_executed', 'state', 'output'].includes(key)
                    )
                )
            );
            return resultKey === rowKey;
        });
    }

    updateResult(row, commandExecuted, state, output) {
        const existingIndex = this.results.findIndex(result => 
            this.findExistingResult(row) === result
        );

        const resultRow = {
            ...row,
            command_executed: commandExecuted,
            state: state,
            output: output
        };

        if (existingIndex >= 0) {
            this.results[existingIndex] = resultRow;
        } else {
            this.results.push(resultRow);
        }
    }

    async saveResults() {
        if (this.results.length === 0) {
            console.log('No results to save');
            return;
        }

        // Ensure all headers are in { id, title } format
        const originalHeaders = Object.keys(this.data[0] || {}).map(key => ({ id: key, title: key }));
        const resultHeaders = [
            { id: 'command_executed', title: 'command_executed' },
            { id: 'state', title: 'state' },
            { id: 'output', title: 'output' }
        ];
        const headers = [...originalHeaders, ...resultHeaders];

        const csvWriter = createCsvWriter({
            path: this.resultsFile,
            header: headers
        });

        await csvWriter.writeRecords(this.results);
    }
}

// Run the application
const runner = new CSVRunner();
runner.run().catch(console.error); 