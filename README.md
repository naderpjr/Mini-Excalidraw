# Mini Excalidraw

A small whiteboard in the browser where everything looks hand-drawn. You can sketch rectangles, ellipses, diamonds, arrows and lines, draw freehand, move things around, undo mistakes and export the result as a PNG.

It's built with plain JavaScript and Vite, with no framework. The whole app is about 270 lines of JS, so it's easy to read from top to bottom.

## Running it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints.

## What you can do

- Draw shapes, arrows, lines and freehand strokes
- Select an element and drag it, or press `Delete` to remove it
- Erase by dragging over things
- Change the color (it also recolors the selected element)
- Undo and redo
- Export the drawing as a PNG
- Come back later: your drawing is saved automatically

Keys `1` to `8` switch tools, `Ctrl/Cmd + Z` undoes, and `Ctrl/Cmd + Shift + Z` redoes.

## How it works

**The drawing is just an array.** Every shape is a plain object with a type, two corner points and a color (freehand strokes keep a list of points instead). Nothing is drawn directly when you move the mouse. The pointer events only change that array, and a `render()` function clears the canvas and draws every element again. Most features follow from this: saving is `JSON.stringify`, and undo is going back to an older copy of the array.

**The hand-drawn look** comes from [rough.js](https://roughjs.com). Each element gets a random `seed` when it's created. Without it, rough.js would wobble the lines differently on every redraw and shapes would shake while you drag them. With the seed saved, a shape always looks the same.

**Freehand strokes** use [perfect-freehand](https://github.com/steveruizok/perfect-freehand), which turns the raw mouse points into a smooth outline with varying thickness. That outline is filled as a path on the canvas.

**Selecting and erasing** rely on a small hit-test. Lines, arrows and freehand strokes are checked by their distance to the cursor. Rectangles, ellipses and diamonds are checked against their bounding box. Moving an element just adds the mouse delta to its coordinates.

**Undo and redo** keep a list of snapshots of the whole array. Every finished action (a new shape, a move, an erase) adds one. Undo and redo move a step pointer back and forth through that list.

**Saving** writes the current scene to `localStorage` after each change and loads it when the page opens.

**Sharp lines on any screen.** The canvas is sized using `devicePixelRatio`, so strokes don't get blurry on retina displays.

**Export** draws the canvas onto a temporary one with a white background (the main canvas is transparent) and downloads it as an image.

## Built with

- [Vite](https://vitejs.dev)
- [rough.js](https://roughjs.com)
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand)
- [Lucide](https://lucide.dev) for the toolbar icons

## Project structure

```
index.html      toolbar and canvas
src/main.js     all the app logic
src/style.css   layout and toolbar styles
```