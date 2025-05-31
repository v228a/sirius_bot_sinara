export interface ChatBotNode {
  id: string;
  type: 'question' | 'answer' | 'start' | 'checklist';
  position: { x: number; y: number };
  data: {
    label: string;
    type: 'question' | 'answer' | 'start' | 'checklist';
    content: string;
    checklistItems?: Array<{ text: string }>;
    attachments?: Array<{
      id: string;
      name: string;
      data: string;
    }>;
  };
  draggable?: boolean;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  type?: string;
} 