// frontend/src/data/taskProblems.ts
export interface TaskProblem {
  id: string;
  type: 'closed' | 'open';
  taskNumber: number;
  title: string;
  problemText: string;
  targetImageUrl?: string;
  targetImageDescription?: string;
  expectedElements?: string[];
}

export const closedTasks: TaskProblem[] = [
  {
    id: 'closed-1',
    type: 'closed',
    taskNumber: 1,
    title: 'Birthday Party Planning',
    problemText: `Emma is planning a birthday party and needs to buy decorations and snacks. She has a budget of $150. Decorations cost $4 each, and each snack pack costs $3. If Emma plans to buy 20 decorations, how many snack packs can she buy without exceeding her budget?`,
    targetImageUrl: '/example-images/birthday-party-budget.png', // You'll need to add this image
    targetImageDescription: 'A visual representation showing Emma\'s budget breakdown with decorations ($4 each) and snack packs ($3 each), including the calculation steps and final answer.',
    expectedElements: [
      'Budget visualization ($150)',
      'Decoration cost calculation (20 × $4 = $80)',
      'Remaining budget calculation ($150 - $80 = $70)',
      'Snack pack calculation ($70 ÷ $3 = 23.33... → 23 snacks)',
      'Clear visual organization of the problem steps'
    ]
  },
  {
    id: 'closed-2',
    type: 'closed',
    taskNumber: 2,
    title: 'Garden Rectangular Area',
    problemText: `A rectangular garden has a length that is 3 meters longer than its width. If the perimeter of the garden is 26 meters, what are the dimensions of the garden?`,
    targetImageUrl: '/example-images/garden-rectangle.png', // You'll need to add this image
    targetImageDescription: 'A diagram showing a rectangle representing the garden with labeled dimensions (width = w, length = w + 3), perimeter formula, and step-by-step algebraic solution.',
    expectedElements: [
      'Rectangle diagram with labeled dimensions',
      'Width labeled as "w"',
      'Length labeled as "w + 3"',
      'Perimeter formula: P = 2(length + width)',
      'Equation setup: 26 = 2(w + (w + 3))',
      'Step-by-step algebraic solution',
      'Final answer: width = 5m, length = 8m'
    ]
  }
];

export const openTasks: TaskProblem[] = [
  {
    id: 'open-1',
    type: 'open',
    taskNumber: 1,
    title: 'Pizza Fraction Problem',
    problemText: `A group of friends ordered 3 large pizzas for their study session. They ate 2/3 of the first pizza, 3/4 of the second pizza, and 1/2 of the third pizza. How much pizza did they eat in total? Express your answer as a mixed number.`,
    expectedElements: [
      'Visual representation of 3 pizzas',
      'Fraction visualization for each pizza',
      'Adding fractions with different denominators',
      'Converting to mixed number',
      'Clear step-by-step calculation'
    ]
  },
  {
    id: 'open-2',
    type: 'open',
    taskNumber: 2,
    title: 'Swimming Pool Linear Relationship',
    problemText: `A swimming pool is being filled with water. The pool starts empty and is filled at a constant rate of 50 gallons per minute. After 2 hours, the pool contains 6,000 gallons. Create a visual representation that shows the relationship between time and the amount of water in the pool, and determine how long it will take to completely fill the pool if its total capacity is 15,000 gallons.`,
    expectedElements: [
      'Linear graph showing time vs. water amount',
      'Clearly labeled axes (time in minutes/hours, water in gallons)',
      'Rate calculation (50 gallons/minute)',
      'Point marking (2 hours, 6000 gallons)',
      'Extrapolation to full capacity (15,000 gallons)',
      'Final time calculation and answer'
    ]
  }
];

export const getTaskProblem = (type: 'closed' | 'open', taskNumber: number): TaskProblem | undefined => {
  const tasks = type === 'closed' ? closedTasks : openTasks;
  return tasks.find(task => task.taskNumber === taskNumber);
};

export const getAllTasks = (): TaskProblem[] => {
  return [...closedTasks, ...openTasks];
};
