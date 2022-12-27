import FileFormatter from './FileFormatter';
import toml from './util/j-toml.min';

class TomlFormatter extends FileFormatter {
  fromFile(content: string) {
    return toml.parse(content) as object;
  }

  toFile(data: object): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return toml.stringify(data as any, {
      newline: '\n',
    });
  }
}

export default new TomlFormatter();