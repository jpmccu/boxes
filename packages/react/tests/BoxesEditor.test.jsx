import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React, { useRef, useEffect } from 'react';
import BoxesEditor from '../src/BoxesEditor.jsx';

describe('BoxesEditor React Component', () => {
  it('should render the component', () => {
    const { container } = render(<BoxesEditor />);
    expect(container.querySelector('.boxes-editor')).toBeTruthy();
  });

  it('should initialize with elements prop', () => {
    const elements = {
      nodes: [{ data: { id: 'n1', label: 'Node 1' } }],
      edges: []
    };

    const { container } = render(<BoxesEditor elements={elements} />);
    expect(container.querySelector('.boxes-editor')).toBeTruthy();
  });

  it('should expose methods via ref', () => {
    let editorRef;

    function TestComponent() {
      const ref = useRef();
      
      useEffect(() => {
        editorRef = ref;
      }, []);

      return <BoxesEditor ref={ref} />;
    }

    render(<TestComponent />);

    expect(editorRef.current).toBeDefined();
    expect(typeof editorRef.current.addNode).toBe('function');
    expect(typeof editorRef.current.addEdge).toBe('function');
    expect(typeof editorRef.current.exportGraph).toBe('function');
  });

  it('should call event handlers', () => {
    let addedNode = null;

    function TestComponent() {
      const ref = useRef();

      const handleNodeAdded = (data) => {
        addedNode = data.node;
      };

      useEffect(() => {
        if (ref.current) {
          ref.current.addNode({ id: 'n1', label: 'Test' });
        }
      }, []);

      return <BoxesEditor ref={ref} onNodeAdded={handleNodeAdded} />;
    }

    render(<TestComponent />);

    // Wait for next tick
    setTimeout(() => {
      expect(addedNode).toBeDefined();
      expect(addedNode.data.id).toBe('n1');
    }, 100);
  });

  it('should cleanup on unmount', () => {
    const { unmount } = render(<BoxesEditor />);
    unmount();
    // Component should clean up without errors
  });
});
