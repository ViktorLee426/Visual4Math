export interface ExampleItem {
  id: string;
  problemText: string;
  imageUrl?: string; // optional exemplar image (placed under /src/assets/examples or a URL)
}

// Example problems; images are optional and can be added later under /src/assets/examples
export const exampleItems: ExampleItem[] = [
  {
    id: "1",
    problemText:
      "There are 10 basketballs within one blue bag and one green bag. If the blue bag has 4 basketballs, how many basketballs are in the green bag?",
    // Put 1.png under frontend/src/data/images/
    imageUrl: new URL('./images/1.png', import.meta.url).toString(),
  },
  // You can add more like this and place images as 2.png, 3.png, ...
  // { id: "2", problemText: "...", imageUrl: new URL('./images/2.png', import.meta.url).toString() }
  {
    id: "2",
    problemText:
      "There are 8 glue sticks and 3 scissors at the art station. How many fewer scissors are there than glue sticks?",
    // Put 2.png under frontend/src/data/images/
    imageUrl: new URL('./images/2.png', import.meta.url).toString(),
  },
  {
    id: "3",
    problemText:
      "Diego has 9 cubes, Jada has 3 cubes. How many more cubes does Diego have compared to Jada?",
    // Put 3.png under frontend/src/data/images/
    imageUrl: new URL('./images/3.png', import.meta.url).toString(),
  },
];


