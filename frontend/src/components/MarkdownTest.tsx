// Test component to verify markdown rendering
import MarkdownText from './MarkdownText';

const MarkdownTest = () => {
  const testContent = `# Substitute and Solve:

   - Substitute \\( l = w + 50 \\) into the perimeter equation: 
     \\[
     2((w + 50) + w) = 500
     \\]
   - Simplify and solve for \\( w \\):
     \\[
     2(2w + 50) = 500
     \\]
     \\[
     4w + 100 = 500
     \\]
     \\[
     4w = 400
     \\]
     \\[
     w = 100
     \\]

## Find the Length:

   - Use \\( l = w + 50 \\) to find \\( l \\):
     \\[
     l = 100 + 50 = 150
     \\]

### Other Markdown Features:

This is **bold text** and this is *italic text*.

Here's some \`inline code\` example.

- Regular bullet point
  - Indented bullet point
    - Double indented
- Another regular bullet

1. Numbered list item
2. Second numbered item
3. Third item`;

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-bold mb-4">Markdown Test</h3>
      <MarkdownText content={testContent} />
    </div>
  );
};

export default MarkdownTest;
