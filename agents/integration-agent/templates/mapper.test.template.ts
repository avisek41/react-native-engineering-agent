import { map{{PascalName}}ApiRowToViewModel } from '../{{camelName}}Display';

describe('map{{PascalName}}ApiRowToViewModel', () => {
  it('correctly maps valid API row to ViewModel', () => {
    const mockRow: any = {
      id: 123,
    };

    const result = map{{PascalName}}ApiRowToViewModel(mockRow);

    expect(result.id).toBe('123');
  });

  it('handles null and undefined properties gracefully', () => {
    const mockRow: any = {
      id: 456,
    };

    const result = map{{PascalName}}ApiRowToViewModel(mockRow);

    expect(result.id).toBe('456');
  });
});
