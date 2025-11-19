export interface PredefinedQuestion {
  id: string;
  title: string;
  question: string;
  category: string;
  icon?: string;
}

export const predefinedQuestions: PredefinedQuestion[] = [
  {
    id: 'copilot-studio-intro',
    title: 'Copilot Studio',
    question: 'What is Copilot Studio?',
    category: 'Getting Started',
    icon: '🤖',
  },
  {
    id: 'copilot-studio-help',
    title: 'Learn Copilot Studio',
    question: 'Help me create a Copilot Studio Agent',
    category: 'Getting Started',
    icon: '🎓',
  },
  {
    id: 'friends-intro',
    title: 'Friends 101',
    question: 'What is the TV Show Friends about?',
    category: 'Entertainment',
    icon: '📺',
  },
  {
    id: 'friends-characters',
    title: 'Know the characters',
    question: 'Who are the main characters in Friends?',
    category: 'Entertainment',
    icon: '👥',
  },
];

export const getQuestionsByCategory = (category?: string): PredefinedQuestion[] => {
  if (!category) return predefinedQuestions;
  return predefinedQuestions.filter(q => q.category === category);
};

export const getCategories = (): string[] => {
  return Array.from(new Set(predefinedQuestions.map(q => q.category)));
};