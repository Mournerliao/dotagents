export function emitResult(options: {
  json: boolean;
  payload: unknown;
  text: string;
}): void {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(options.payload, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    options.text.endsWith("\n") ? options.text : `${options.text}\n`,
  );
}
