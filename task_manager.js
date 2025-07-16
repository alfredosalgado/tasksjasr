import fs from 'fs';
import path from 'path';
import TaskExecutor from './task_executor.js';

class TaskManager {
    constructor() {
        this.workingDirectory = this.getWorkingDirectory();
        this.tasksFilePath = this.getTasksFilePath();
        this.taskExecutor = new TaskExecutor(this.workingDirectory);
        this.autoExecute = true; // Flag para habilitar/deshabilitar ejecución automática
        this.tasks = this.loadTasks();
        this.nextTaskId = this.getNextTaskId();
        this.autoDirectoryCheck = true; // Flag para habilitar verificación automática de directorio
    }

    getWorkingDirectory() {
        // 1. Si hay variable de entorno TASKSJASR_WORKING_DIR, usarla
        if (process.env.TASKSJASR_WORKING_DIR) {
            let workingDir = process.env.TASKSJASR_WORKING_DIR;
            
            // Si es "." o ruta relativa, usar el directorio desde donde se invocó el proceso
            if (workingDir === "." || workingDir.startsWith("./")) {
                // Intentar usar variables de entorno que indiquen el directorio original
                const originalDir = process.env.INIT_CWD || process.env.PWD || process.cwd();
                workingDir = path.resolve(originalDir, workingDir.replace(/^\.?\/?/, ''));
            } else if (!path.isAbsolute(workingDir)) {
                // Si no es absoluta, hacerla relativa al directorio original
                const originalDir = process.env.INIT_CWD || process.env.PWD || process.cwd();
                workingDir = path.resolve(originalDir, workingDir);
            } else {
                workingDir = path.resolve(workingDir);
            }
            
            console.error(`TasksJASR: Usando directorio de trabajo desde variable de entorno: ${workingDir}`);
            return workingDir;
        }

        // 2. Verificar variable de entorno INIT_CWD (npm/yarn) - directorio donde se ejecutó originalmente
        if (process.env.INIT_CWD && fs.existsSync(process.env.INIT_CWD)) {
            console.error(`TasksJASR: Usando directorio de trabajo desde INIT_CWD: ${process.env.INIT_CWD}`);
            return process.env.INIT_CWD;
        }
        
        // 3. Verificar variable de entorno PWD (Unix/Linux)
        if (process.env.PWD && process.env.PWD !== process.cwd() && fs.existsSync(process.env.PWD)) {
            console.error(`TasksJASR: Usando directorio de trabajo desde PWD: ${process.env.PWD}`);
            return process.env.PWD;
        }

        // 4. Intentar detectar desde variables de entorno de Kiro/IDE
        const kiroVars = [
            'KIRO_WORKSPACE_DIR',
            'WORKSPACE_DIR', 
            'PROJECT_DIR',
            'VSCODE_CWD',
            'KIRO_PROJECT_ROOT',
            'EDITOR_WORKSPACE'
        ];
        
        for (const envVar of kiroVars) {
            if (process.env[envVar] && fs.existsSync(process.env[envVar])) {
                console.error(`TasksJASR: Usando directorio de workspace desde ${envVar}: ${process.env[envVar]}`);
                return process.env[envVar];
            }
        }

        // 5. Intentar detectar el workspace de Kiro desde argumentos del proceso
        const args = process.argv.join(' ');
        console.error(`TasksJASR: Argumentos del proceso: ${args}`);
        
        // 6. Intentar detectar el directorio del proyecto actual desde el contexto
        const projectDir = this.detectCurrentProjectDirectory();
        if (projectDir) {
            console.error(`TasksJASR: Directorio de proyecto detectado: ${projectDir}`);
            return projectDir;
        }
        
        // 7. Como último recurso, usar el directorio actual
        const currentDir = process.cwd();
        console.error(`TasksJASR: Usando directorio actual: ${currentDir}`);
        return currentDir;
    }

    getTasksFilePath() {
        // 1. Si hay variable de entorno TASKSJASR_FILE_PATH, usarla
        if (process.env.TASKSJASR_FILE_PATH) {
            let filePath = process.env.TASKSJASR_FILE_PATH;
            
            // Si la ruta empieza con ./ o /, es relativa al directorio de trabajo
            if (filePath.startsWith('./') || filePath.startsWith('/')) {
                filePath = path.join(this.workingDirectory, filePath.replace(/^\.?\//, ''));
            } else if (!path.isAbsolute(filePath)) {
                // Si no es absoluta, hacerla relativa al directorio de trabajo
                filePath = path.join(this.workingDirectory, filePath);
            }
            
            console.error(`TasksJASR: Usando archivo de tareas desde variable de entorno: ${filePath}`);
            return filePath;
        }

        // 2. Por defecto, usar tasks.json en el directorio de trabajo
        const defaultPath = path.join(this.workingDirectory, 'tasks.json');
        console.error(`TasksJASR: Usando archivo de tareas por defecto: ${defaultPath}`);
        return defaultPath;
    }

    loadTasks() {
        try {
            if (fs.existsSync(this.tasksFilePath)) {
                const data = fs.readFileSync(this.tasksFilePath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
        return [];
    }

    saveTasks() {
        try {
            // Crear directorio si no existe
            const dir = path.dirname(this.tasksFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.tasksFilePath, JSON.stringify(this.tasks, null, 2));
            console.error(`TasksJASR: Tareas guardadas en: ${this.tasksFilePath}`);
        } catch (error) {
            console.error('Error saving tasks:', error);
        }
    }

    getNextTaskId() {
        if (this.tasks.length === 0) return 1;
        
        const taskIds = this.tasks.map(task => {
            const match = task.id.match(/task-(\d+)$/);
            return match ? parseInt(match[1]) : 0;
        });
        
        return Math.max(...taskIds) + 1;
    }

    async addTask(title, description, autoExecute = this.autoExecute) {
        // Verificar si ya existe una tarea similar
        const existingTask = this.findSimilarTask(title, description);
        if (existingTask) {
            return {
                isDuplicate: true,
                existingTask: existingTask,
                message: `⚠️ TAREA DUPLICADA DETECTADA\n\n` +
                        `Ya existe una tarea similar:\n` +
                        `ID: ${existingTask.id}\n` +
                        `Título: ${existingTask.title}\n` +
                        `Estado: ${existingTask.status}\n\n` +
                        `❓ ¿Quieres continuar creando esta tarea duplicada?\n` +
                        `Si es así, usa 'add_task' con un título más específico.`
            };
        }

        const newTask = {
            id: `task-${this.nextTaskId++}`,
            title,
            description,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        // Agregar tarea al array y guardar
        this.tasks.push(newTask);
        this.saveTasks();
        
        // Generar instrucciones de ejecución para el agente IA
        const executionInstructions = this.generateExecutionInstructions(newTask);
        newTask.executionInstructions = executionInstructions;
        
        return newTask;
    }

    getTask(taskId) {
        return this.tasks.find(task => task.id === taskId) || null;
    }

    updateTask(taskId, updates) {
        const taskIndex = this.tasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            Object.assign(this.tasks[taskIndex], updates);
            this.saveTasks();
            return true;
        }
        return false;
    }

    deleteTask(taskId) {
        const initialLength = this.tasks.length;
        this.tasks = this.tasks.filter(task => task.id !== taskId);
        if (this.tasks.length < initialLength) {
            this.saveTasks();
            return true;
        }
        return false;
    }

    listTasks(filter = {}) {
        return this.tasks.filter(task => {
            for (const key in filter) {
                if (task[key] !== filter[key]) {
                    return false;
                }
            }
            return true;
        }).sort((a, b) => {
            const aNum = parseInt(a.id.replace('task-', ''));
            const bNum = parseInt(b.id.replace('task-', ''));
            return aNum - bNum;
        });
    }

    toMarkdown() {
        const tasks = this.listTasks();
        let markdown = '# Lista de Tareas\n\n';
        
        if (tasks.length === 0) {
            markdown += 'No hay tareas para mostrar.\n';
            return markdown;
        }

        tasks.forEach(task => {
            markdown += `## ${task.title} (ID: ${task.id})\n`;
            markdown += `**Descripción:** ${task.description}\n`;
            markdown += `**Estado:** ${task.status}\n`;
            markdown += `**Creada el:** ${new Date(task.createdAt).toLocaleString()}\n\n`;
        });
        return markdown;
    }

    // Métodos de integración con MCP Pensamiento Secuencial
    async importFromSequentialThinking(sequentialThoughtData) {
        const tasks = this.convertSequentialThoughtsToTasks(sequentialThoughtData.thoughts);
        const addedTasks = [];
        
        for (const task of tasks) {
            const newTask = await this.addTask(task.title, task.description);
            addedTasks.push(newTask);
        }
        
        return addedTasks;
    }

    convertSequentialThoughtsToTasks(thoughts) {
        return thoughts.map((thought, index) => ({
            title: thought.content,
            description: `Paso ${index + 1}: ${thought.content}`,
            priority: this.determinePriority(thought),
            dependencies: this.findDependencies(thought, thoughts)
        }));
    }

    determinePriority(thought) {
        if (thought.isRevision) return 'high';
        if (thought.branchFromThought) return 'medium';
        return 'normal';
    }

    findDependencies(thought, allThoughts) {
        if (!thought.branchFromThought) return [];
        return [`task-${thought.branchFromThought}`];
    }

    // Métodos de ejecución de tareas
    async executeTask(taskId) {
        const task = this.getTask(taskId);
        if (!task) {
            throw new Error(`Tarea con ID ${taskId} no encontrada`);
        }

        if (task.status === 'completed') {
            return { success: true, message: 'Tarea ya completada' };
        }

        // Actualizar estado a 'in-progress'
        this.updateTask(taskId, { status: 'in-progress' });

        try {
            const executionResult = await this.taskExecutor.executeTask(task);
            
            // Actualizar tarea con resultado de ejecución
            const updates = {
                status: executionResult.success ? 'completed' : 'failed',
                executionResult: executionResult,
                completedAt: executionResult.success ? new Date().toISOString() : undefined,
                failedAt: !executionResult.success ? new Date().toISOString() : undefined
            };

            this.updateTask(taskId, updates);
            return executionResult;

        } catch (error) {
            // Actualizar estado a 'failed' en caso de error
            this.updateTask(taskId, { 
                status: 'failed',
                executionResult: {
                    success: false,
                    error: error.message,
                    executedAt: new Date().toISOString()
                },
                failedAt: new Date().toISOString()
            });
            throw error;
        }
    }

    async executePendingTasks() {
        const pendingTasks = this.listTasks({ status: 'pending' });
        const results = [];

        for (const task of pendingTasks) {
            try {
                const result = await this.executeTask(task.id);
                results.push({ taskId: task.id, success: true, result });
            } catch (error) {
                results.push({ taskId: task.id, success: false, error: error.message });
            }
        }

        return results;
    }

    setAutoExecute(enabled) {
        this.autoExecute = enabled;
    }

    getExecutionStats() {
        const allTasks = this.listTasks();
        const stats = {
            total: allTasks.length,
            pending: allTasks.filter(t => t.status === 'pending').length,
            inProgress: allTasks.filter(t => t.status === 'in-progress').length,
            completed: allTasks.filter(t => t.status === 'completed').length,
            failed: allTasks.filter(t => t.status === 'failed').length
        };
        return stats;
    }

    // Generar instrucciones específicas para que el agente IA ejecute la tarea
    generateExecutionInstructions(task) {
        const description = task.description.toLowerCase();
        const title = task.title.toLowerCase();
        const fullText = `${title} ${description}`;

        const instructions = {
            taskId: task.id,
            actionType: this.detectActionType(fullText),
            specificInstructions: [],
            suggestedTools: [],
            workingDirectory: this.workingDirectory
        };

        // Generar instrucciones específicas basadas en el tipo de acción
        if (fullText.includes('crear archivo')) {
            instructions.specificInstructions.push(
                `Crear un archivo usando la herramienta fsWrite`,
                `Nombre del archivo: ${this.extractFileName(task.description)}`,
                `Contenido: ${this.extractFileContent(task.description)}`
            );
            instructions.suggestedTools.push('fsWrite');
        }

        if (fullText.includes('crear carpeta') || fullText.includes('crear directorio')) {
            const folderName = this.extractFolderName(task.description);
            instructions.specificInstructions.push(
                `Crear directorio usando fsWrite`,
                `Nombre del directorio: ${folderName}`
            );
            instructions.suggestedTools.push('fsWrite');
        }

        if (fullText.includes('instalar') && fullText.includes('dependencia')) {
            const dependency = this.extractDependencyName(task.description);
            instructions.specificInstructions.push(
                `Ejecutar comando de instalación usando executePwsh`,
                `Comando: npm install ${dependency}`,
                `Directorio: ${this.workingDirectory}`
            );
            instructions.suggestedTools.push('executePwsh');
        }

        if (fullText.includes('ejecutar comando')) {
            const command = this.extractCommand(task.description);
            instructions.specificInstructions.push(
                `Ejecutar el siguiente comando usando executePwsh`,
                `Comando: ${command}`,
                `Directorio: ${this.workingDirectory}`
            );
            instructions.suggestedTools.push('executePwsh');
        }

        if (fullText.includes('crear componente')) {
            const componentName = this.extractComponentName(task.description);
            instructions.specificInstructions.push(
                `Crear componente React usando fsWrite`,
                `Nombre: ${componentName}`,
                `Ubicación: src/components/${componentName}.js`,
                `Generar código de componente React básico`
            );
            instructions.suggestedTools.push('fsWrite');
        }

        if (fullText.includes('modificar archivo')) {
            const fileName = this.extractFileName(task.description);
            instructions.specificInstructions.push(
                `Leer el archivo existente usando readFile`,
                `Archivo: ${fileName}`,
                `Realizar las modificaciones especificadas`,
                `Guardar cambios usando strReplace o fsWrite`
            );
            instructions.suggestedTools.push('readFile', 'strReplace');
        }

        // Si no se detecta un tipo específico, dar instrucciones generales
        if (instructions.specificInstructions.length === 0) {
            instructions.specificInstructions.push(
                `Analizar la descripción de la tarea: "${task.description}"`,
                `Determinar las acciones necesarias para completar la tarea`,
                `Usar las herramientas apropiadas del IDE para ejecutar la tarea`,
                `Actualizar el estado de la tarea cuando esté completada`
            );
            instructions.suggestedTools.push('readFile', 'fsWrite', 'executePwsh');
        }

        return instructions;
    }

    detectActionType(fullText) {
        if (fullText.includes('crear archivo')) return 'create_file';
        if (fullText.includes('crear carpeta')) return 'create_folder';
        if (fullText.includes('instalar dependencia')) return 'install_dependency';
        if (fullText.includes('ejecutar comando')) return 'execute_command';
        if (fullText.includes('crear componente')) return 'create_component';
        if (fullText.includes('modificar archivo')) return 'modify_file';
        if (fullText.includes('escribir código')) return 'write_code';
        return 'generic_task';
    }

    // Métodos auxiliares para extraer información (reutilizados del TaskExecutor)
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

    // Método para detectar el directorio del proyecto actual
    detectCurrentProjectDirectory() {
        // 1. Buscar en directorios comunes del usuario
        const userDir = process.env.USERPROFILE || process.env.HOME;
        if (!userDir) return null;

        const commonProjectDirs = [
            path.join(userDir, 'Desktop'),
            path.join(userDir, 'Documents'),
            path.join(userDir, 'Projects'),
            path.join(userDir, 'workspace'),
            path.join(userDir, 'dev'),
            path.join(userDir, 'code')
        ];

        // 2. Buscar el directorio más reciente con indicadores de proyecto
        let mostRecentProject = null;
        let mostRecentTime = 0;

        for (const baseDir of commonProjectDirs) {
            if (!fs.existsSync(baseDir)) continue;

            try {
                const entries = fs.readdirSync(baseDir, { withFileTypes: true });
                
                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    
                    const projectPath = path.join(baseDir, entry.name);
                    
                    // Verificar si tiene indicadores de proyecto
                    const indicators = ['package.json', '.git', 'src', 'index.html', 'README.md', '.vscode'];
                    const hasProjectIndicator = indicators.some(indicator => 
                        fs.existsSync(path.join(projectPath, indicator))
                    );
                    
                    if (hasProjectIndicator) {
                        const stats = fs.statSync(projectPath);
                        if (stats.mtime.getTime() > mostRecentTime) {
                            mostRecentTime = stats.mtime.getTime();
                            mostRecentProject = projectPath;
                        }
                    }
                }
            } catch (error) {
                // Ignorar errores de acceso a directorios
                continue;
            }
        }

        return mostRecentProject;
    }

    // Método para permitir al usuario especificar el directorio manualmente
    setWorkingDirectory(newDirectory) {
        if (fs.existsSync(newDirectory)) {
            this.workingDirectory = newDirectory;
            this.tasksFilePath = this.getTasksFilePath();
            this.taskExecutor = new TaskExecutor(this.workingDirectory);
            this.tasks = this.loadTasks();
            this.nextTaskId = this.getNextTaskId();
            console.error(`TasksJASR: Directorio de trabajo actualizado a: ${newDirectory}`);
            return true;
        }
        return false;
    }

    // Verificación del directorio antes de cada operación
    async checkWorkingDirectory() {
        const currentDirectory = this.workingDirectory;
        const suggestedDirectory = this.detectCurrentProjectDirectory();
        
        // Verificar si el directorio actual es realmente un directorio de Kiro/IDE
        const isKiroDirectory = currentDirectory.includes('Kiro') || 
                               currentDirectory.includes('AppData') ||
                               currentDirectory.includes('Programs');
        
        return {
            currentDirectory: currentDirectory,
            suggestedDirectory: suggestedDirectory,
            needsUpdate: (suggestedDirectory && suggestedDirectory !== currentDirectory) || isKiroDirectory,
            tasksFilePath: this.tasksFilePath,
            isKiroDirectory: isKiroDirectory
        };
    }

    // Método mejorado para detectar el directorio del proyecto actual
    detectCurrentProjectDirectory() {
        // 1. Primero verificar si hay variables de entorno específicas
        if (process.env.TASKSJASR_WORKING_DIR && process.env.TASKSJASR_WORKING_DIR !== ".") {
            const envDir = path.resolve(process.env.TASKSJASR_WORKING_DIR);
            if (fs.existsSync(envDir)) {
                return envDir;
            }
        }

        // 2. Buscar en directorios comunes del usuario
        const userDir = process.env.USERPROFILE || process.env.HOME;
        if (!userDir) return null;

        const commonProjectDirs = [
            path.join(userDir, 'Desktop'),
            path.join(userDir, 'Documents'),
            path.join(userDir, 'Projects'),
            path.join(userDir, 'workspace'),
            path.join(userDir, 'dev'),
            path.join(userDir, 'code')
        ];

        // 3. Buscar el directorio más reciente con indicadores de proyecto
        let mostRecentProject = null;
        let mostRecentTime = 0;

        for (const baseDir of commonProjectDirs) {
            if (!fs.existsSync(baseDir)) continue;

            try {
                const entries = fs.readdirSync(baseDir, { withFileTypes: true });
                
                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    
                    const projectPath = path.join(baseDir, entry.name);
                    
                    // Verificar si tiene indicadores de proyecto
                    const indicators = ['package.json', '.git', 'src', 'index.html', 'README.md', '.vscode', '.kiro'];
                    const hasProjectIndicator = indicators.some(indicator => 
                        fs.existsSync(path.join(projectPath, indicator))
                    );
                    
                    if (hasProjectIndicator) {
                        const stats = fs.statSync(projectPath);
                        // Priorizar directorios modificados recientemente
                        if (stats.mtime.getTime() > mostRecentTime) {
                            mostRecentTime = stats.mtime.getTime();
                            mostRecentProject = projectPath;
                        }
                    }
                }
            } catch (error) {
                // Ignorar errores de acceso a directorios
                continue;
            }
        }

        return mostRecentProject;
    }

    // Habilitar/deshabilitar verificación automática de directorio
    setAutoDirectoryCheck(enabled) {
        this.autoDirectoryCheck = enabled;
        console.error(`TasksJASR: Verificación automática de directorio ${enabled ? 'habilitada' : 'deshabilitada'}`);
    }

    // Buscar tareas similares para evitar duplicados
    findSimilarTask(title, description) {
        const normalizeText = (text) => text.toLowerCase().trim();
        const newTitle = normalizeText(title);
        const newDescription = normalizeText(description);

        return this.tasks.find(task => {
            const existingTitle = normalizeText(task.title);
            const existingDescription = normalizeText(task.description);

            // Verificar similitud en título (80% de coincidencia)
            const titleSimilarity = this.calculateSimilarity(newTitle, existingTitle);
            
            // Verificar si contienen palabras clave similares
            const titleWords = newTitle.split(' ').filter(word => word.length > 3);
            const existingTitleWords = existingTitle.split(' ').filter(word => word.length > 3);
            
            const commonWords = titleWords.filter(word => 
                existingTitleWords.some(existingWord => 
                    existingWord.includes(word) || word.includes(existingWord)
                )
            );

            // Considerar duplicado si:
            // 1. Títulos muy similares (>80% similitud)
            // 2. O si comparten 2+ palabras clave importantes
            return titleSimilarity > 0.8 || commonWords.length >= 2;
        });
    }

    // Calcular similitud entre dos strings (algoritmo simple)
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    // Calcular distancia de Levenshtein (distancia de edición)
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Método para limpiar tareas duplicadas existentes
    removeDuplicateTasks() {
        const uniqueTasks = [];
        const seenTasks = new Set();

        for (const task of this.tasks) {
            const taskKey = `${task.title.toLowerCase().trim()}_${task.status}`;
            
            if (!seenTasks.has(taskKey)) {
                seenTasks.add(taskKey);
                uniqueTasks.push(task);
            }
        }

        const removedCount = this.tasks.length - uniqueTasks.length;
        this.tasks = uniqueTasks;
        
        if (removedCount > 0) {
            this.saveTasks();
            console.error(`TasksJASR: Eliminadas ${removedCount} tareas duplicadas`);
        }

        return {
            removedCount: removedCount,
            remainingTasks: uniqueTasks.length
        };
    }
}

export default TaskManager;
