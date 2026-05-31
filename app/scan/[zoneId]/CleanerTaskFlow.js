'use client';

import { useRef, useState } from 'react';

export default function CleanerTaskFlow({ tasks }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [grades, setGrades] = useState({});
  const cardRefs = useRef([]);
  const listRef = useRef(null);

  function focusJob(index) {
    setCurrentIndex(index);
    cardRefs.current[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  function gradeTask(taskId, grade, index) {
    setGrades((existing) => ({ ...existing, [taskId]: grade }));
    const nextIndex = Math.min(index + 1, tasks.length - 1);

    window.setTimeout(() => {
      focusJob(nextIndex);
    }, 120);
  }

  function trackManualScroll() {
    const list = listRef.current;
    if (!list) return;

    const listCentre = list.getBoundingClientRect().top + list.clientHeight / 2;
    let closestIndex = currentIndex;
    let closestDistance = Number.POSITIVE_INFINITY;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const cardCentre = rect.top + rect.height / 2;
      const distance = Math.abs(cardCentre - listCentre);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex !== currentIndex) {
      setCurrentIndex(closestIndex);
    }
  }

  return (
    <div className="compact-flow">
      <div className="flow-position">
        <span className="badge">Current job {currentIndex + 1} of {tasks.length}</span>
        <span className="muted">Scroll manually or tap a grade to jump to the next job.</span>
      </div>

      <div className="compact-task-list" ref={listRef} onScroll={trackManualScroll}>
        {tasks.map((task, index) => {
          const isCurrent = index === currentIndex;
          const selectedGrade = grades[task.id];

          return (
            <article
              className={`compact-task-card ${isCurrent ? 'current-task-card' : ''} ${selectedGrade ? 'graded-task-card' : ''}`}
              key={task.id}
              ref={(node) => { cardRefs.current[index] = node; }}
              onClick={() => focusJob(index)}
            >
              <span className={`completion-bubble ${selectedGrade ? 'completion-done' : 'completion-open'}`}>
                {selectedGrade ? 'Completed' : 'Non-completed'}
              </span>

              <div className="compact-task-top">
                <div className="task-number">{index + 1}</div>
                <div>
                  <h3>{task.title}</h3>
                  <div className="muted">
                    {selectedGrade ? `Grade ${selectedGrade}/5 recorded` : isCurrent ? 'Current job' : index < currentIndex ? 'Previous job' : 'Coming up next'}
                  </div>
                </div>
              </div>

              {(task.photoRequired || task.commentRequired) && (
                <div className="compact-flags">
                  {task.photoRequired && <span className="flag required-flag">Forced photo</span>}
                  {task.commentRequired && <span className="flag">Comment required</span>}
                </div>
              )}

              <div className="grade-panel compact-grade-panel">
                <div>
                  <strong>Grade completion</strong>
                  <span className="muted">Tap 1-5 to fill this card and jump to the next job</span>
                </div>
                <div className="grade-buttons" aria-label={`Grade ${task.title}`}>
                  {[1, 2, 3, 4, 5].map((grade) => (
                    <button
                      className={`grade-button grade-${grade} ${selectedGrade === grade ? 'selected-grade' : ''}`}
                      type="button"
                      key={grade}
                      onClick={(event) => {
                        event.stopPropagation();
                        gradeTask(task.id, grade, index);
                      }}
                    >
                      <span>{grade}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="task-actions compact-actions">
                <button className={task.photoRequired ? 'button photo-required-button' : 'button secondary'} type="button" onClick={(event) => event.stopPropagation()}>
                  {task.photoRequired ? 'Required photo' : 'Optional photo'}
                </button>
                <button className="button secondary" type="button" onClick={(event) => event.stopPropagation()}>{task.commentRequired ? 'Required note' : 'Optional note'}</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
