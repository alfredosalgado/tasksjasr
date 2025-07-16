import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class TaskExecutor {
    constructor(workingDirectory) {
        this.workingDirectory = workingDirectory;
        this.executionStrategies = new Map();
        this.setupExecutionStrategies();
    }

    setupExecutionStrategies() {
        // Estrategias de ejecución basadas en palabras clave
        this.executionStrategies.set('crear archivo', this.createFile.bind(this));
        this.executionStrategies.set('crear carpeta', this.createFolder.bind(this));
        this.executionStrategies.set('escribir código', this.writeCode.bind(this));
        this.executionStrategies.set('ejecutar comando', this.executeCommand.bind(this));
        this.executionStrategies.set('instalar dependencia', this.installDependency.bind(this));
        this.executionStrategies.set('crear componente', this.createComponent.bind(this));
        this.executionStrategies.set('modificar archivo', this.modifyFile.bind(this));
    }

    async executeTask(task) {
        try {
            console.log(`Ejecutando tarea: ${task.title}`);
            
            const strategy = this.findExecutionStrategy(task);
            if (strategy) {
                const result = await strategy(task);
                return {
                    success: true,
                    result: result,
                    executedAt: new Date().toISOString()
                };
            } else {
                // Estrategia genérica para tareas no reconocidas
                return await this.genericExecution(task);
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                executedAt: new Date().toISOString()
            };
        }
    }

    findExecutionStrategy(task) {
        const description = task.description.toLowerCase();
        const title = task.title.toLowerCase();
        const fullText = `${title} ${description}`;

        for (const [keyword, strategy] of this.executionStrategies) {
            if (fullText.includes(keyword)) {
                return strategy;
            }
        }
        return null;
    }

    async createFile(task) {
        const description = task.description;
        const fileName = this.extractFileName(description);
        const content = this.extractFileContent(description);
        
        const filePath = path.join(this.workingDirectory, fileName);
        fs.writeFileSync(filePath, content);
        
        return `Archivo creado: ${fileName}`;
    }

    async createFolder(task) {
        const folderName = this.extractFolderName(task.description);
        const folderPath = path.join(this.workingDirectory, folderName);
        
        fs.mkdirSync(folderPath, { recursive: true });
        
        return `Carpeta creada: ${folderName}`;
    }

    async writeCode(task) {
        const fileName = this.extractFileName(task.description);
        const codeContent = this.generateCodeContent(task);
        
        const filePath = path.join(this.workingDirectory, fileName);
        fs.writeFileSync(filePath, codeContent);
        
        return `Código escrito en: ${fileName}`;
    }

    async executeCommand(task) {
        const command = this.extractCommand(task.description);
        
        try {
            const output = execSync(command, { 
                cwd: this.workingDirectory,
                encoding: 'utf8',
                timeout: 30000 // 30 segundos timeout
            });
            
            return `Comando ejecutado: ${command}\nSalida: ${output}`;
        } catch (error) {
            throw new Error(`Error ejecutando comando: ${error.message}`);
        }
    }

    async installDependency(task) {
        const dependency = this.extractDependencyName(task.description);
        const command = `npm install ${dependency}`;
        
        try {
            const output = execSync(command, { 
                cwd: this.workingDirectory,
                encoding: 'utf8'
            });
            
            return `Dependencia instalada: ${dependency}`;
        } catch (error) {
            throw new Error(`Error instalando dependencia: ${error.message}`);
        }
    }

    async createComponent(task) {
        const componentName = this.extractComponentName(task.description);
        const componentCode = this.generateComponentCode(componentName, task);
        
        const fileName = `${componentName}.js`;
        const filePath = path.join(this.workingDirectory, 'src', 'components', fileName);
        
        // Crear directorio si no existe
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, componentCode);
        
        return `Componente creado: ${fileName}`;
    }

    async modifyFile(task) {
        const fileName = this.extractFileName(task.description);
        const modifications = this.extractModifications(task.description);
        
        const filePath = path.join(this.workingDirectory, fileName);
        
        if (fs.existsSync(filePath)) {
            let content = fs.readFileSync(filePath, 'utf8');
            content += `\n// Modificación automática: ${modifications}`;
            fs.writeFileSync(filePath, content);
            
            return `Archivo modificado: ${fileName}`;
        } else {
            throw new Error(`Archivo no encontrado: ${fileName}`);
        }
    }

    async genericExecution(task) {
        // Para tareas que no coinciden con ninguna estrategia específica
        // Crear un log de la tarea ejecutada
        const logEntry = {
            taskId: task.id,
            title: task.title,
            description: task.description,
            executedAt: new Date().toISOString(),
            status: 'executed_generically'
        };
        
        const logPath = path.join(this.workingDirectory, 'Tasks', 'execution_log.json');
        let logs = [];
        
        if (fs.existsSync(logPath)) {
            logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        }
        
        logs.push(logEntry);
        fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
        
        return `Tarea ejecutada genéricamente y registrada en log`;
    }

    // Métodos auxiliares para extraer información de las descripciones
    extractFileName(description) {
        const match = description.match(/archivo\s+["']?([^"'\s]+)["']?/i);
        return match ? match[1] : 'nuevo_archivo.txt';
    }

    extractFolderName(description) {
        const match = description.match(/carpeta\s+["']?([^"'\s]+)["']?/i);
        return match ? match[1] : 'nueva_carpeta';
    }

    extractCommand(description) {
        const match = description.match(/comando\s+["']?([^"']+)["']?/i);
        return match ? match[1] : 'echo "Comando no especificado"';
    }

    extractDependencyName(description) {
        const match = description.match(/dependencia\s+["']?([^"'\s]+)["']?/i);
        return match ? match[1] : 'express';
    }

    extractComponentName(description) {
        const match = description.match(/componente\s+["']?([^"'\s]+)["']?/i);
        return match ? match[1] : 'NuevoComponente';
    }

    extractFileContent(description) {
        const match = description.match(/contenido\s*:\s*["']?([^"']+)["']?/i);
        return match ? match[1] : '// Contenido generado automáticamente';
    }

    extractModifications(description) {
        const match = description.match(/modificar\s+(.+)/i);
        return match ? match[1] : 'modificación no especificada';
    }

    generateCodeContent(task) {
        return `// Código generado automáticamente para: ${task.title}
// Descripción: ${task.description}
// Generado el: ${new Date().toISOString()}

console.log('Código ejecutado automáticamente');
`;
    }

    generateComponentCode(componentName, task) {
        return `// Componente ${componentName} generado automáticamente
// Tarea: ${task.title}
// Descripción: ${task.description}

import React from 'react';

const ${componentName} = () => {
    return (
        <div>
            <h1>${componentName}</h1>
            <p>Componente generado automáticamente</p>
        </div>
    );
};

export default ${componentName};
`;
    }
}

export default TaskExecutor;