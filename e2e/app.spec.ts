import { expect, test, type Page } from '@playwright/test';

const status = (page: Page) => page.getByTestId('cube-status');
const moveCount = (page: Page) => page.getByTestId('move-count');
const position = (page: Page) => page.getByTestId('playback-position');
const algorithmField = (page: Page) => page.getByRole('textbox', { name: 'Algorithm' });
const choosePuzzle = (page: Page, name: string) => page.getByRole('combobox', { name: 'Puzzle' }).selectOption({ label: name });

// Every flow below must also run clean: no console errors and no uncaught exceptions.
let errors: string[];
test.afterEach(() => expect(errors).toEqual([]));

// Fast turns and no inspection keep the suite quick. The app picks these up as saved settings.
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem('twistlab.settings', JSON.stringify({ state: { speed: 4, inspection: 0 }, version: 0 })),
  );
  await page.goto('/');
  // A canvas starts life 300 pixels wide. Wait until the 3D view has sized it to fill its stage.
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    return !!canvas && canvas.clientWidth > 300 && canvas.clientWidth === canvas.parentElement?.clientWidth;
  });
});

test('turns with the keyboard and tracks the real cube state', async ({ page }) => {
  await expect(status(page)).toHaveText('Solved');
  await page.keyboard.press('r');
  await expect(moveCount(page)).toHaveText('1');
  await expect(status(page)).toHaveText('Unsolved');
  await expect(page.getByTestId('current-move')).toHaveText('R');

  await page.keyboard.press('Shift+R');
  await expect(status(page)).toHaveText('Solved');
  await expect(page.getByRole('region', { name: 'Move history' }).getByRole('listitem')).toHaveText(['R', "R'"]);

  // R U R' U' six times is the identity: 24 more turns and the cube must be solved again.
  for (let round = 0; round < 6; round++)
    for (const key of ['r', 'u', 'Shift+R', 'Shift+U']) await page.keyboard.press(key);
  await expect(moveCount(page)).toHaveText('26');
  await expect(status(page)).toHaveText('Solved');
});

test('rejects an invalid algorithm and executes a valid one step by step', async ({ page }) => {
  await algorithmField(page).fill('R U Q');
  await expect(page.getByRole('alert')).toContainText('"Q" is not a move');
  await expect(page.getByRole('button', { name: 'Execute', exact: true })).toBeDisabled();
  await algorithmField(page).press('Enter');
  await expect(moveCount(page)).toHaveText('0');

  await algorithmField(page).fill("(R U R' U')6");
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(position(page)).toHaveText('24 / 24', { timeout: 20_000 });
  await expect(status(page)).toHaveText('Solved');
  await expect(moveCount(page)).toHaveText('24');

  await algorithmField(page).fill('R U F');
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(position(page)).toHaveText('3 / 3');
  await expect(status(page)).toHaveText('Unsolved');
  await page.getByRole('button', { name: 'Previous move' }).click();
  await expect(position(page)).toHaveText('2 / 3');
  await page.getByRole('button', { name: 'Back to start' }).click();
  await expect(position(page)).toHaveText('0 / 3');
  await expect(status(page)).toHaveText('Solved');
});

test('typing an algorithm does not turn the cube', async ({ page }) => {
  await algorithmField(page).fill('');
  await algorithmField(page).pressSequentially("RUF x y'");
  await expect(moveCount(page)).toHaveText('0');
  await expect(status(page)).toHaveText('Solved');
  await algorithmField(page).press('Enter');
  await expect(position(page)).toHaveText('5 / 5');
  await expect(moveCount(page)).toHaveText('3'); // rotations are not counted as moves
});

test('clicking the stage hands the keyboard back to the cube', async ({ page }) => {
  await algorithmField(page).click();
  await expect(algorithmField(page)).toBeFocused();
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + 30, box.y + 140);
  await page.keyboard.press('r');
  await expect(moveCount(page)).toHaveText('1');
  await expect(algorithmField(page)).toHaveValue("R U R' U'");
});

test('scrambles, undoes, redoes and resets', async ({ page }) => {
  await page.getByRole('button', { name: 'Scramble', exact: true }).click();
  await expect(status(page)).toHaveText('Unsolved');
  await expect(page.getByRole('region', { name: 'Move history' })).toContainText('Scramble');
  await expect(moveCount(page)).toHaveText('0');

  await page.keyboard.press('f'); // the button was clicked with the mouse: keys must still reach the cube
  await expect(moveCount(page)).toHaveText('1');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(moveCount(page)).toHaveText('0');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(moveCount(page)).toHaveText('1');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(moveCount(page)).toHaveText('0');

  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(status(page)).toHaveText('Solved');
});

test('dragging a face turns a layer, dragging the background only orbits', async ({ page }) => {
  const box = (await page.locator('canvas').boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  const drag = async (fromX: number, fromY: number, byX: number, byY: number) => {
    await page.mouse.move(centre.x + fromX, centre.y + fromY);
    await page.mouse.down();
    await page.mouse.move(centre.x + fromX + byX, centre.y + fromY + byY, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300); // let the turn finish: the cube ignores drags mid-turn
  };
  const currentMove = page.getByTestId('current-move');

  // Offsets are where the default camera puts each sticker. The layer must follow the pointer like a real cube:
  // front centre dragged right carries the middle layer round to the right face,
  await drag(-86, 45, 100, 20);
  await expect(currentMove).toHaveText('E');
  // the front of the top layer dragged left is a clockwise U,
  await drag(-90, -36, -100, -20);
  await expect(currentMove).toHaveText('U');
  // and the right face's front column dragged up turns the front face counter-clockwise.
  await drag(47, 72, 0, -100);
  await expect(currentMove).toHaveText("F'");
  await expect(moveCount(page)).toHaveText('3');
  await expect(status(page)).toHaveText('Unsolved');

  // A drag that starts on the background moves the camera and nothing else.
  await drag(-box.width / 2 + 24, -box.height / 2 + 120, 140, 50);
  await expect(moveCount(page)).toHaveText('3');
});

test('switches to the 2×2 and uses only the moves it has', async ({ page }) => {
  await choosePuzzle(page, '2×2 Pocket Cube');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2×2 Pocket Cube');
  await page.keyboard.press('r');
  await page.keyboard.press('m'); // no middle slice on a 2×2
  await page.keyboard.press('u');
  await expect(moveCount(page)).toHaveText('2');
  await algorithmField(page).fill('R M');
  await expect(page.getByRole('alert')).toContainText('This puzzle has no M move');

  // The library lists every puzzle by category. Choosing one puts it on the stage; Play opens the playground.
  await page.getByRole('button', { name: 'Puzzle Library' }).click();
  await expect(page.getByRole('region', { name: 'Classic Cubes' })).toContainText('6 of 6 playable');
  await expect(page.getByText('Coming soon')).toHaveCount(8);
  await page.getByRole('button', { name: /3×3 Rubik's Cube/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("3×3 Rubik's Cube");
  await expect(status(page)).toHaveText('Solved');
  // The library only shows the puzzle: a drag across it orbits the camera, and the move keys do nothing.
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2 + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press('r');
  await expect(moveCount(page)).toHaveText('0');
  await expect(status(page)).toHaveText('Solved');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(algorithmField(page)).toBeVisible();
});

test('plays a bigger cube, with its inner layers and deeper wide turns', async ({ page }) => {
  await choosePuzzle(page, "5×5 Professor's Cube");
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("5×5 Professor's Cube");
  await algorithmField(page).fill('3Rw 2U M Q');
  await expect(page.getByRole('alert')).toContainText('"Q" is not a move');
  await algorithmField(page).fill("3Rw 2U' M x");
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(position(page)).toHaveText('4 / 4');
  await expect(moveCount(page)).toHaveText('3'); // the rotation is not a move
  await expect(status(page)).toHaveText('Unsolved');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.getByRole('region', { name: 'Move history' }).getByRole('listitem')).toHaveText(['3r', "2U'", 'M']);

  await choosePuzzle(page, "4×4 Rubik's Revenge");
  await page.keyboard.press('m'); // an even cube has no middle layer
  await page.keyboard.press('Alt+r');
  await expect(page.getByTestId('current-move')).toHaveText('r');
  await expect(moveCount(page)).toHaveText('1');
});

test('plays a puzzle that is not a cube: turns in thirds, tips, and solved by its own rules', async ({ page }) => {
  await choosePuzzle(page, 'Pyraminx');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pyraminx');
  await expect(status(page)).toHaveText('Solved');
  await page.keyboard.press('u');
  await expect(page.getByTestId('current-move')).toHaveText('U');
  await expect(status(page)).toHaveText('Unsolved');
  await page.keyboard.press('u');
  await page.keyboard.press('u'); // three thirds make a whole turn
  await expect(status(page)).toHaveText('Solved');
  await page.keyboard.press('Alt+l'); // Alt turns the tip alone
  await expect(page.getByTestId('current-move')).toHaveText('l');
  await page.keyboard.press('Shift+Alt+L');
  await expect(page.getByTestId('current-move')).toHaveText("l'");
  await expect(status(page)).toHaveText('Solved');
  await page.keyboard.press('d'); // a Pyraminx has no D
  await expect(moveCount(page)).toHaveText('5');

  await page.getByRole('button', { name: 'Scramble', exact: true }).click();
  await expect(status(page)).toHaveText('Unsolved');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(status(page)).toHaveText('Solved');

  // A Megaminx turns in fifths and has faces a cube does not.
  await choosePuzzle(page, 'Megaminx');
  await algorithmField(page).fill("BR2' DBL R++ D--");
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(position(page)).toHaveText('4 / 4', { timeout: 10_000 });
  await expect(page.getByTestId('current-move')).toHaveText('D--');
  await algorithmField(page).fill('F5');
  await expect(page.getByRole('alert')).toContainText('comes back round after 5');
});

test("plays a Square-1 and a Rubik's Clock by their own rules", async ({ page }) => {
  await choosePuzzle(page, 'Square-1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Square-1');
  // A slash with a corner across the cut is refused before anything runs.
  await algorithmField(page).fill('(-1,0)/');
  await expect(page.getByRole('alert')).toContainText('Move 2, /, cannot be made from this position');
  await expect(page.getByRole('button', { name: 'Execute', exact: true })).toBeDisabled();
  await algorithmField(page).fill('(1,0)/');
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(position(page)).toHaveText('2 / 2');
  await expect(status(page)).toHaveText('Unsolved');
  await page.getByRole('button', { name: 'Back to start' }).click();
  await expect(status(page)).toHaveText('Solved');
  // U turns the top a twelfth, / turns the right half over, and Shift reverses.
  await page.keyboard.press('u');
  await expect(page.getByTestId('current-move')).toHaveText('(1,0)');
  await page.keyboard.press('/');
  await expect(page.getByTestId('current-move')).toHaveText('/');
  await expect(status(page)).toHaveText('Unsolved');
  await page.keyboard.press('/');
  await page.keyboard.press('Shift+U');
  await expect(page.getByTestId('current-move')).toHaveText('(-1,0)');
  await expect(status(page)).toHaveText('Solved');

  await choosePuzzle(page, "Rubik's Clock");
  await algorithmField(page).fill('UR3+ y2 UL1- y2');
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(position(page)).toHaveText('4 / 4');
  await expect(moveCount(page)).toHaveText('2'); // turning it over is not a move
  await expect(status(page)).toHaveText('Unsolved');
  await page.getByRole('button', { name: 'Reverse' }).click();
  await expect(algorithmField(page)).toHaveValue('y2 UL1+ y2 UR3-');
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(position(page)).toHaveText('4 / 4');
  await expect(status(page)).toHaveText('Solved');
  await page.keyboard.press('y');
  await expect(page.getByTestId('current-move')).toHaveText('y2');
});

test('solves a shape mod by shape, and turns its pieces by dragging', async ({ page }) => {
  await choosePuzzle(page, 'Mirror Cube');
  await expect(status(page)).toHaveText('Solved');
  await algorithmField(page).fill("(R U R' U')6 x y");
  await page.getByRole('button', { name: 'Execute', exact: true }).click();
  await expect(position(page)).toHaveText('26 / 26', { timeout: 20_000 });
  await expect(status(page)).toHaveText('Solved'); // a box again, whichever way it is held
  await page.getByRole('button', { name: 'Reset', exact: true }).click();

  // Drag across the middle of the puzzle: some layer turns, and the puzzle is no longer a box.
  const box = (await page.locator('canvas').boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(centre.x - 20, centre.y + 10);
  await page.mouse.down();
  await page.mouse.move(centre.x + 90, centre.y + 30, { steps: 8 });
  await page.mouse.up();
  await expect(moveCount(page)).toHaveText('1');
  await expect(status(page)).toHaveText('Unsolved');
  await expect(page.getByTestId('current-move')).toHaveText(/^[RLUDFBMES]'?$/);

  // A drag that starts on the background still only moves the camera.
  await page.waitForTimeout(400);
  await page.mouse.move(box.x + 24, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 170, { steps: 8 });
  await page.mouse.up();
  await expect(moveCount(page)).toHaveText('1');
});

test('the Algorithm Lab demonstrates an algorithm and remembers favourites', async ({ page }) => {
  await page.getByRole('button', { name: 'Algorithm Lab' }).click();
  await page.getByRole('tab', { name: 'PLL' }).click();
  await page.getByRole('button', { name: 'Execute T perm' }).click();
  await expect(status(page)).toHaveText('Unsolved'); // the demo starts from the case the algorithm solves
  await expect(position(page)).toHaveText('14 / 14', { timeout: 20_000 });
  await expect(status(page)).toHaveText('Solved');

  await page.getByRole('button', { name: 'Add to favourites' }).first().click();
  await page.reload();
  await page.getByRole('button', { name: 'Algorithm Lab' }).click();
  await page.getByRole('tab', { name: 'Favourites' }).click();
  await expect(page.getByRole('heading', { name: 'Ua perm' })).toBeVisible();
});

test('Learn mode demonstrates a step on the cube', async ({ page }) => {
  await page.getByRole('button', { name: 'Learn', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'White cross' })).toBeVisible();
  await page.getByRole('button', { name: 'Demo: White facing you' }).click();
  await expect(position(page)).toHaveText('4 / 4', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Mark complete' }).click();
  await expect(page.getByText('1 / 7 complete')).toBeVisible();
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(page.getByRole('heading', { name: 'White corners' })).toBeVisible();
});

test('the timer records a solve with Space and keeps it across a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Timer & Statistics' }).click();
  await expect(page.getByTestId('timer-scramble')).not.toBeEmpty();
  await expect(status(page)).toHaveText('Unsolved'); // the cube shows the scramble

  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await page.keyboard.press('r'); // cube keys are off while timing
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  const solves = page.getByRole('region', { name: 'Solve history' }).getByRole('listitem');
  await expect(solves).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Statistics' })).toContainText('Solves1');
  await expect(page.getByTestId('timer-readout')).not.toHaveText('0.00');
  await expect(moveCount(page)).toHaveText('0');

  await page.reload();
  await page.getByRole('button', { name: 'Timer & Statistics' }).click();
  await expect(solves).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete solve 1' }).click();
  await expect(solves).toHaveCount(0);
});

test('shows the shortcut reference', async ({ page }) => {
  await page.getByRole('button', { name: 'Shortcuts' }).click();
  await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeHidden();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('fits the screen and navigates from the tab bar', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // The puzzle keeps a usable share of the screen above the controls.
    expect((await page.locator('canvas').boundingBox())!.height).toBeGreaterThan(250);

    await page.getByRole('button', { name: 'Execute', exact: true }).click();
    await expect(position(page)).toHaveText('4 / 4');
    await page.getByRole('button', { name: 'Timer & Statistics' }).click();
    await expect(page.getByTestId('timer-readout')).toBeVisible();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('button', { name: 'Restore defaults' })).toBeVisible();
  });
});
