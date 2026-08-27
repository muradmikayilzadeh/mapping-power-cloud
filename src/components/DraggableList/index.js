import React, { useEffect, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';

// react-beautiful-dnd's Droppable double-fires its setup in React 18 Strict
// Mode, which it doesn't tolerate; delaying its mount by a frame works
// around that (same fix already used for the Era editor's map/group lists).
function StrictModeDroppable({ children, ...props }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);
  if (!enabled) return null;
  return <Droppable {...props}>{children}</Droppable>;
}

/**
 * Generic drag-to-reorder list. Deliberately puts `dragHandleProps` only on
 * whatever element `renderItem` attaches them to (a small grip handle),
 * rather than the whole row — rows here often contain real inputs, buttons,
 * or a rich text editor, and making the entire row a drag handle swallows
 * clicks/typing inside them.
 */
export default function DraggableList({ droppableId, items, getId, onReorder, renderItem, className }) {
  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;
    const reordered = Array.from(items);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);
    onReorder(reordered);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <StrictModeDroppable droppableId={droppableId}>
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef} className={className}>
            {items.map((item, index) => {
              const id = String(getId(item));
              return (
                <Draggable key={id} draggableId={id} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div ref={dragProvided.innerRef} {...dragProvided.draggableProps}>
                      {renderItem(item, index, dragProvided.dragHandleProps, dragSnapshot)}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </StrictModeDroppable>
    </DragDropContext>
  );
}
