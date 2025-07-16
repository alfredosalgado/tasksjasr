#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import TaskManager from './task_manager.js';

class TasksJASRServer {
  constructor() {
    this.server = new Server(
      {
        name: 'tasksjasr',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.taskManager = new TaskManager();
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'add_task',
            description: 'Añadir una nueva tarea al orquestador',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Título de la tarea'
                },
                description: {
                  type: 'string',
                  description: 'Descripción detallada de la tarea'
                }
              },
              required: ['title', 'description']
            }
          },
          {
            name: 'list_tasks',
            description: 'Listar todas las tareas o filtrar por criterios',
            inputSchema: {
              type: 'object',
              properties: {
                filter: {
                  type: 'object',
                  description: 'Filtros para aplicar (status, etc.)'
                }
              }
            }
          },
          {
            name: 'update_task',
            description: 'Actualizar una tarea existente',
            inputSchema: {
              type: 'object',
              properties: {
                taskId: {
                  type: 'string',
                  description: 'ID de la tarea a actualizar'
                },
                updates: {
                  type: 'object',
                  description: 'Campos a actualizar (status, etc.)'
                }
              },
              required: ['taskId', 'updates']
            }
          },
          {
            name: 'delete_task',
            description: 'Eliminar una tarea',
            inputSchema: {
              type: 'object',
              properties: {
                taskId: {
                  type: 'string',
                  description: 'ID de la tarea a eliminar'
                }
              },
              required: ['taskId']
            }
          },
          {
            name: 'export_to_markdown',
            description: 'Exportar todas las tareas a formato Markdown',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'import_from_sequential_thinking',
            description: 'Importar tareas desde el MCP de Pensamiento Secuencial',
            inputSchema: {
              type: 'object',
              properties: {
                sequentialThoughtData: {
                  type: 'object',
                  description: 'Datos del MCP de Pensamiento Secuencial',
                  properties: {
                    thoughts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'number' },
                          content: { type: 'string' },
                          nextThoughtNeeded: { type: 'boolean' },
                          branchFromThought: { type: ['number', 'null'] },
                          isRevision: { type: 'boolean' }
                        }
                      }
                    }
                  }
                }
              },
              required: ['sequentialThoughtData']
            }
          },
          {
            name: 'execute_task',
            description: 'Ejecutar una tarea específica manualmente',
            inputSchema: {
              type: 'object',
              properties: {
                taskId: {
                  type: 'string',
                  description: 'ID de la tarea a ejecutar'
                }
              },
              required: ['taskId']
            }
          },
          {
            name: 'execute_pending_tasks',
            description: 'Ejecutar todas las tareas pendientes',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'get_execution_stats',
            description: 'Obtener estadísticas de ejecución de tareas',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'toggle_auto_execute',
            description: 'Habilitar o deshabilitar la ejecución automática de tareas',
            inputSchema: {
              type: 'object',
              properties: {
                enabled: {
                  type: 'boolean',
                  description: 'true para habilitar, false para deshabilitar'
                }
              },
              required: ['enabled']
            }
          },
          {
            name: 'set_working_directory',
            description: 'Configurar el directorio de trabajo donde se guardarán las tareas',
            inputSchema: {
              type: 'object',
              properties: {
                directory: {
                  type: 'string',
                  description: 'Ruta del directorio donde guardar las tareas'
                }
              },
              required: ['directory']
            }
          },
          {
            name: 'get_current_directory',
            description: 'Obtener el directorio de trabajo actual donde se guardan las tareas',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'remove_duplicate_tasks',
            description: 'Eliminar tareas duplicadas del archivo de tareas',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'add_task': {
            const { title, description } = args;
            const result = await this.taskManager.addTask(title, description);
            
            // Si es una tarea duplicada, devolver mensaje de advertencia
            if (result.isDuplicate) {
              return {
                content: [
                  {
                    type: 'text',
                    text: result.message
                  }
                ]
              };
            }
            
            // Si es una tarea normal, formatear respuesta con instrucciones
            const response = this.formatTaskCreationResponse(result);
            
            return {
              content: [
                {
                  type: 'text',
                  text: response
                }
              ]
            };
          }

          case 'list_tasks': {
            const { filter = {} } = args;
            const tasks = this.taskManager.listTasks(filter);
            return {
              content: [
                {
                  type: 'text',
                  text: `Tareas encontradas (${tasks.length}):\n${JSON.stringify(tasks, null, 2)}`
                }
              ]
            };
          }

          case 'update_task': {
            const { taskId, updates } = args;
            const success = this.taskManager.updateTask(taskId, updates);
            if (success) {
              const updatedTask = this.taskManager.getTask(taskId);
              return {
                content: [
                  {
                    type: 'text',
                    text: `Tarea actualizada exitosamente:\n${JSON.stringify(updatedTask, null, 2)}`
                  }
                ]
              };
            } else {
              throw new McpError(ErrorCode.InvalidRequest, `Tarea con ID ${taskId} no encontrada`);
            }
          }

          case 'delete_task': {
            const { taskId } = args;
            const success = this.taskManager.deleteTask(taskId);
            if (success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Tarea ${taskId} eliminada exitosamente`
                  }
                ]
              };
            } else {
              throw new McpError(ErrorCode.InvalidRequest, `Tarea con ID ${taskId} no encontrada`);
            }
          }

          case 'export_to_markdown': {
            const markdown = this.taskManager.toMarkdown();
            return {
              content: [
                {
                  type: 'text',
                  text: `Reporte en Markdown generado:\n\n${markdown}`
                }
              ]
            };
          }

          case 'import_from_sequential_thinking': {
            const { sequentialThoughtData } = args;
            const importedTasks = await this.taskManager.importFromSequentialThinking(sequentialThoughtData);
            return {
              content: [
                {
                  type: 'text',
                  text: `${importedTasks.length} tareas importadas desde MCP Pensamiento Secuencial:\n${JSON.stringify(importedTasks, null, 2)}`
                }
              ]
            };
          }

          case 'execute_task': {
            const { taskId } = args;
            try {
              const result = await this.taskManager.executeTask(taskId);
              return {
                content: [
                  {
                    type: 'text',
                    text: `Tarea ${taskId} ejecutada:\n${JSON.stringify(result, null, 2)}`
                  }
                ]
              };
            } catch (error) {
              throw new McpError(ErrorCode.InternalError, `Error ejecutando tarea ${taskId}: ${error.message}`);
            }
          }

          case 'execute_pending_tasks': {
            try {
              const results = await this.taskManager.executePendingTasks();
              return {
                content: [
                  {
                    type: 'text',
                    text: `Tareas pendientes ejecutadas:\n${JSON.stringify(results, null, 2)}`
                  }
                ]
              };
            } catch (error) {
              throw new McpError(ErrorCode.InternalError, `Error ejecutando tareas pendientes: ${error.message}`);
            }
          }

          case 'get_execution_stats': {
            const stats = this.taskManager.getExecutionStats();
            return {
              content: [
                {
                  type: 'text',
                  text: `Estadísticas de ejecución:\n${JSON.stringify(stats, null, 2)}`
                }
              ]
            };
          }

          case 'toggle_auto_execute': {
            const { enabled } = args;
            this.taskManager.setAutoExecute(enabled);
            return {
              content: [
                {
                  type: 'text',
                  text: `Ejecución automática ${enabled ? 'habilitada' : 'deshabilitada'}`
                }
              ]
            };
          }

          case 'set_working_directory': {
            const { directory } = args;
            const success = this.taskManager.setWorkingDirectory(directory);
            if (success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `✅ Directorio de trabajo actualizado a: ${directory}\n📁 Las tareas se guardarán en: ${this.taskManager.tasksFilePath}`
                  }
                ]
              };
            } else {
              throw new McpError(ErrorCode.InvalidRequest, `Directorio no encontrado: ${directory}`);
            }
          }

          case 'get_current_directory': {
            return {
              content: [
                {
                  type: 'text',
                  text: `📁 Directorio de trabajo actual: ${this.taskManager.workingDirectory}\n💾 Archivo de tareas: ${this.taskManager.tasksFilePath}\n📊 Total de tareas: ${this.taskManager.tasks.length}`
                }
              ]
            };
          }

          case 'remove_duplicate_tasks': {
            const result = this.taskManager.removeDuplicateTasks();
            return {
              content: [
                {
                  type: 'text',
                  text: `🧹 LIMPIEZA DE TAREAS DUPLICADAS COMPLETADA\n\n` +
                        `📊 Tareas eliminadas: ${result.removedCount}\n` +
                        `✅ Tareas restantes: ${result.remainingTasks}\n\n` +
                        `${result.removedCount > 0 ? '🎉 Archivo de tareas optimizado exitosamente!' : '✨ No se encontraron tareas duplicadas.'}`
                }
              ]
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Herramienta desconocida: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Error interno: ${error.message}`);
      }
    });
  }

  formatTaskCreationResponse(newTask) {
    const instructions = newTask.executionInstructions;
    
    let response = `✅ TAREA CREADA: ${newTask.title} (ID: ${newTask.id})\n\n`;
    response += `📋 DESCRIPCIÓN: ${newTask.description}\n\n`;
    
    if (instructions && instructions.specificInstructions.length > 0) {
      response += `🤖 INSTRUCCIONES PARA EJECUTAR ESTA TAREA:\n\n`;
      
      instructions.specificInstructions.forEach((instruction, index) => {
        response += `${index + 1}. ${instruction}\n`;
      });
      
      if (instructions.suggestedTools.length > 0) {
        response += `\n🔧 HERRAMIENTAS SUGERIDAS: ${instructions.suggestedTools.join(', ')}\n`;
      }
      
      response += `\n📁 DIRECTORIO DE TRABAJO: ${instructions.workingDirectory}\n`;
      response += `\n⚡ ACCIÓN REQUERIDA: Por favor, ejecuta estas instrucciones ahora para completar la tarea.\n`;
      response += `Cuando termines, actualiza el estado de la tarea usando: update_task con taskId "${newTask.id}" y status "completed"\n`;
    } else {
      response += `⚠️ Esta tarea requiere análisis manual para determinar las acciones específicas.\n`;
    }
    
    return response;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Servidor MCP TasksJASR iniciado');
  }
}

const server = new TasksJASRServer();
server.run().catch(console.error);