/**
 * Pure transformation mapping backend API DTO to screen-local ViewModel
 */

export interface __Entity__DTO {
  id: string;
  name: string;
  createdAt: string;
}

export interface __Entity__ViewModel {
  id: string;
  displayName: string;
  formattedDate: string;
}

export function map__Entity__ToViewModel(dto?: __Entity__DTO | null): __Entity__ViewModel | null {
  if (!dto) {
    return null;
  }

  return {
    id: dto.id,
    displayName: dto.name || 'Unnamed',
    formattedDate: new Date(dto.createdAt).toLocaleDateString(),
  };
}
