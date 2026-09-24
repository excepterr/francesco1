import fs from 'fs';
import path from 'path';

export function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            arrayOfFiles.push(fullPath);
        }
    }
    return arrayOfFiles;
}

export function getModuleNames(commandsPath: string): string[] {
    return fs
        .readdirSync(commandsPath, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
}