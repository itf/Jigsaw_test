import paper from 'paper';

// Setup paper.js for tests
paper.setup(new paper.Size(2000, 2000));

// Conditionally import jsdom-only libraries
try {
  require('@testing-library/jest-dom');
} catch (e) {
  // Ignore in non-jsdom environments
}
