const TaskManager = require('./task_manager');

// Crear una instancia del TaskManager
const taskManager = new TaskManager();

// Ejemplo 1: Uso básico del TaskManager
console.log('=== Ejemplo 1: Uso Básico ===');

// Añadir tareas manualmente
taskManager.addTask('Diseñar interfaz de usuario', 'Crear mockups y wireframes para la aplicación');
taskManager.addTask('Implementar backend API', 'Desarrollar endpoints REST para la aplicación');
taskManager.addTask('Configurar base de datos', 'Instalar y configurar PostgreSQL');

// Listar todas las tareas
console.log('Tareas creadas:');
console.log(taskManager.listTasks());

// Actualizar estado de una tarea
taskManager.updateTask('task-1', { status: 'in-progress' });
console.log('\nTarea actualizada:');
console.log(taskManager.getTask('task-1'));

// Generar reporte en Markdown
console.log('\n=== Reporte en Markdown ===');
console.log(taskManager.toMarkdown());

// Ejemplo 2: Integración con MCP Pensamiento Secuencial
console.log('\n=== Ejemplo 2: Integración con MCP Pensamiento Secuencial ===');

// Simular datos del MCP Pensamiento Secuencial
const sequentialThoughtData = {
  thoughts: [
    {
      id: 1,
      content: 'Analizar los requisitos del proyecto',
      nextThoughtNeeded: true,
      branchFromThought: null,
      isRevision: false
    },
    {
      id: 2,
      content: 'Diseñar la arquitectura del sistema',
      nextThoughtNeeded: true,
      branchFromThought: 1,
      isRevision: false
    },
    {
      id: 3,
      content: 'Implementar funcionalidades core',
      nextThoughtNeeded: true,
      branchFromThought: 2,
      isRevision: false
    },
    {
      id: 4,
      content: 'Revisar y optimizar el diseño',
      nextThoughtNeeded: false,
      branchFromThought: 2,
      isRevision: true
    },
    {
      id: 5,
      content: 'Realizar pruebas y deployment',
      nextThoughtNeeded: false,
      branchFromThought: 3,
      isRevision: false
    }
  ]
};

// Crear un nuevo TaskManager para el ejemplo de integración
const integratedTaskManager = new TaskManager();

// Importar tareas desde el MCP Pensamiento Secuencial
const importedTasks = integratedTaskManager.importFromSequentialThinking(sequentialThoughtData);

console.log('Tareas importadas desde MCP Pensamiento Secuencial:');
console.log(importedTasks);

// Generar reporte final
console.log('\n=== Reporte Final de Tareas Integradas ===');
console.log(integratedTaskManager.toMarkdown());

// Ejemplo 3: Filtrado de tareas
console.log('\n=== Ejemplo 3: Filtrado de Tareas ===');

// Filtrar tareas por estado
const pendingTasks = integratedTaskManager.listTasks({ status: 'pending' });
console.log('Tareas pendientes:', pendingTasks.length);

// Ejemplo de uso con actualizaciones de estado
integratedTaskManager.updateTask('task-1', { status: 'in-progress' });
integratedTaskManager.updateTask('task-2', { status: 'completed' });

// Filtrar tareas completadas
const completedTasks = integratedTaskManager.listTasks({ status: 'completed' });
console.log('Tareas completadas:', completedTasks);

console.log('\n=== Ejemplo completado ===');