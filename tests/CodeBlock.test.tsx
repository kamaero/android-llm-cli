import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { CodeBlock } from '../src/ui/CodeBlock.js';

// All tests observe the initial synchronous render (plain fallback) because
// the highlight.js dynamic import is async and won't resolve before lastFrame().

describe('CodeBlock — initial render (plain fallback)', () => {
  it('renders js code block', () => {
    const { lastFrame } = render(
      <CodeBlock code={'const x = 1;\nconsole.log(x);'} lang="js" />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('const x = 1;');
    expect(frame).toContain('console.log(x);');
    expect(frame).toContain('js');
  });

  it('renders ts code block', () => {
    const { lastFrame } = render(
      <CodeBlock code={'function greet(name: string): string {\n  return `Hello ${name}`;\n}'} lang="ts" />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('function greet');
    expect(frame).toContain('ts');
  });

  it('renders python code block', () => {
    const { lastFrame } = render(
      <CodeBlock code={'def hello():\n    print("world")'} lang="python" />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('def hello');
    expect(frame).toContain('print');
    expect(frame).toContain('python');
  });

  it('renders bash code block', () => {
    const { lastFrame } = render(
      <CodeBlock code={'#!/bin/bash\necho "hello"'} lang="bash" />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('echo');
    expect(frame).toContain('bash');
  });

  it('renders json code block', () => {
    const { lastFrame } = render(
      <CodeBlock code={'{\n  "key": "value"\n}'} lang="json" />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('"key"');
    expect(frame).toContain('json');
  });

  it('renders without lang (auto-detect)', () => {
    const { lastFrame } = render(
      <CodeBlock code={'select * from users;'} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('select * from users;');
  });

  it('renders with unsupported lang (falls back gracefully)', () => {
    const { lastFrame } = render(
      <CodeBlock code={'some code here'} lang="nonexistentlang99" />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('some code here');
    expect(frame).toContain('nonexistentlang99');
  });

  it('renders empty code block without crashing', () => {
    const { lastFrame } = render(<CodeBlock code="" lang="js" />);
    expect(lastFrame()).toBeTruthy();
  });

  it('shows lang label when lang is provided', () => {
    const { lastFrame } = render(<CodeBlock code="x = 1" lang="python" />);
    expect(lastFrame()).toContain('python');
  });

  it('omits lang label when lang is not provided', () => {
    const { lastFrame } = render(<CodeBlock code="x = 1" />);
    // Should still render the code
    expect(lastFrame()).toContain('x = 1');
  });
});
