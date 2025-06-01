import { ChatBotNode } from '../types';
import { Edge } from 'reactflow';

export interface BotNode {
  id: string;
  text: string;
  answer?: string;
  attachments?: Array<{
    id: string;
    name: string;
  }>;
  checklist?: {
    title: string;
    items: string[];
  };
  children: BotNode[];
}

export function buildHierarchy(startNodeId: string, nodes: ChatBotNode[], edges: Edge[]): BotNode[] {
  const result: BotNode[] = [];
  // Находим все исходящие связи из текущего узла
  const outgoingEdges = edges.filter(edge => edge.source === startNodeId);
  // Сначала собираем все вопросы
  const questionEdges = outgoingEdges.filter(edge => {
    const targetNode = nodes.find(node => node.id === edge.target);
    return targetNode?.data.type === 'question';
  });
  // Затем для каждого вопроса собираем его ответ, чеклист и дочерние вопросы
  for (const edge of questionEdges) {
    const questionNode = nodes.find(node => node.id === edge.target);
    if (questionNode) {
      // Находим ответ для текущего вопроса
      const answerNode = edges
        .filter(e => e.source === questionNode.id)
        .map(e => nodes.find(n => n.id === e.target))
        .find(n => n?.data.type === 'answer');
      // Находим чеклист для текущего вопроса (если есть)
      const checklistNode = edges
        .filter(e => e.source === questionNode.id)
        .map(e => nodes.find(n => n.id === e.target))
        .find(n => n?.data.type === 'checklist');
      const checklist = checklistNode ? {
        title: checklistNode.data.label,
        items: checklistNode.data.checklistItems?.map(item => item.text) || []
      } : undefined;
      const node: BotNode = {
        id: questionNode.id,
        text: questionNode.data.label,
        children: buildHierarchy(questionNode.id, nodes, edges)
      };
      // Добавляем ответ только если он есть
      if (answerNode) {
        node.answer = answerNode.data.label;
      }
      // Добавляем чеклист только если он есть
      if (checklist && checklist.items.length > 0) {
        node.checklist = checklist;
      }
      // Добавляем вложения только если они есть
      if (questionNode.data.attachments && questionNode.data.attachments.length > 0) {
        node.attachments = questionNode.data.attachments.map(attachment => ({
          id: attachment.id,
          name: attachment.name
        }));
      }
      result.push(node);
    }
  }
  return result;
} 