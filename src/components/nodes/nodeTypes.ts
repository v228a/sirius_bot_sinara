import { NodeTypes } from 'reactflow';
import StartNode from './start/StartNode';
import QuestionNode from './question/QuestionNode';
import AnswerNode from './answer/AnswerNode';

export const nodeTypes: NodeTypes = {
  start: StartNode,
  question: QuestionNode,
  answer: AnswerNode,
}; 