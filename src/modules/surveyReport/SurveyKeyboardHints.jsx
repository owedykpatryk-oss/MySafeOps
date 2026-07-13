/** Keyboard shortcut hints for the survey editor footer. */
export default function SurveyKeyboardHints() {
  return (
    <div className="app-survey-kbd-hints" aria-label="Keyboard shortcuts">
      <kbd>Ctrl</kbd>+<kbd>S</kbd> save
      <span className="app-survey-kbd-hints__sep">·</span>
      <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> tabs
      <span className="app-survey-kbd-hints__sep">·</span>
      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> preview
    </div>
  );
}
