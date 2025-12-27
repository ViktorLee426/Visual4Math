// frontend/src/data/mathProblems.ts
// Math word problems for each tool (A, B, C)
// Each tool has 4 problems: addition, subtraction, multiplication, division

export interface MathProblem {
  id: string;
  operation: 'addition' | 'subtraction' | 'multiplication' | 'division';
  problemText: string;
  imageUrl: string;
}

// Tool A problems
export const toolAProblems: MathProblem[] = [
  {
    id: 'toolA-add',
    operation: 'addition',
    problemText: 'Elena has 4 balloons, and Nick has 2 balloons. How many do they have altogether?',
    imageUrl: new URL('./images/add1.png', import.meta.url).toString(),
  },
  {
    id: 'toolA-sub',
    operation: 'subtraction',
    problemText: 'There are 7 dots in total. 3 dots are outside the cup. How many dots are under the cup?',
    imageUrl: new URL('./images/sub1.png', import.meta.url).toString(),
  },
  {
    id: 'toolA-mult',
    operation: 'multiplication',
    problemText: 'There are two plates of apples. Each plate has 3 apples. How many apples are there in total?',
    imageUrl: new URL('./images/mult1.png', import.meta.url).toString(),
  },
  {
    id: 'toolA-div',
    operation: 'division',
    problemText: 'There are 9 balls. If we divide them into groups of 3, how many groups are there?',
    imageUrl: new URL('./images/div1.png', import.meta.url).toString(),
  },
];

// Tool B problems
export const toolBProblems: MathProblem[] = [
  {
    id: 'toolB-add',
    operation: 'addition',
    problemText: 'Sam has 2 balloons. Mia has 3 balloons. How many balloons do they have altogether?',
    imageUrl: new URL('./images/add2.png', import.meta.url).toString(),
  },
  {
    id: 'toolB-sub',
    operation: 'subtraction',
    problemText: 'There are three green apples and two red apples. If we take away three green apples, how many apples are there in total?',
    imageUrl: new URL('./images/sub2.png', import.meta.url).toString(),
  },
  {
    id: 'toolB-mult',
    operation: 'multiplication',
    problemText: 'There are 3 groups of cats, and each group has 2 cats. How many cats are there in total?',
    imageUrl: new URL('./images/mult2.png', import.meta.url).toString(),
  },
  {
    id: 'toolB-div',
    operation: 'division',
    problemText: 'There are 6 stars that need to be shared equally among 3 boxes. How many stars go in each box?',
    imageUrl: new URL('./images/div2.png', import.meta.url).toString(),
  },
];

// Tool C problems
export const toolCProblems: MathProblem[] = [
  {
    id: 'toolC-add',
    operation: 'addition',
    problemText: 'Emma bought 2 strawberry ice creams and 3 chocolate ice creams. How many ice creams did she buy in total?',
    imageUrl: new URL('./images/add3.png', import.meta.url).toString(),
  },
  {
    id: 'toolC-sub',
    operation: 'subtraction',
    problemText: 'There were 7 donuts on the plate. The boy ate 4 of them. How many donuts are left?',
    imageUrl: new URL('./images/sub3.png', import.meta.url).toString(),
  },
  {
    id: 'toolC-mult',
    operation: 'multiplication',
    problemText: 'There are 3 trays of cupcakes. Each tray has 2 cupcakes. How many cupcakes are there in total?',
    imageUrl: new URL('./images/mult3.png', import.meta.url).toString(),
  },
  {
    id: 'toolC-div',
    operation: 'division',
    problemText: 'There are 8 cupcakes that need to be divided equally onto 2 plates. How many cupcakes are on each plate?',
    imageUrl: new URL('./images/div3.png', import.meta.url).toString(),
  },
];

// Helper function to get problems for a specific tool
export const getProblemsForTool = (tool: 'A' | 'B' | 'C'): MathProblem[] => {
  switch (tool) {
    case 'A':
      return toolAProblems;
    case 'B':
      return toolBProblems;
    case 'C':
      return toolCProblems;
    default:
      return [];
  }
};

