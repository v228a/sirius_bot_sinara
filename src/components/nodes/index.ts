import { NodeTypes } from 'reactflow';
import StartNode from './StartNode';
import QuestionNode from './QuestionNode';
import AnswerNode from './AnswerNode';

export const nodeTypes: NodeTypes = {
  start: StartNode,
  question: QuestionNode,
  answer: AnswerNode,
}; 