// external
import { apiRequest } from 'api/apiClient';
import { ENDPOINTS } from 'api/endPoints';
import { logger } from 'utils';

// types — barrel only
import type {
  {{PascalName}}Item,
  {{PascalName}}Params,
  {{PascalName}}Response,
} from 'types';

export type {
  {{PascalName}}Item,
  {{PascalName}}Params,
  {{PascalName}}Response,
} from 'types';

export const fetch{{PascalName}} = async (
  params: {{PascalName}}Params,
): Promise<{{PascalName}}Response> => {
  logger.debug('[{{PascalName}}] fetch', params);

  return apiRequest<{{PascalName}}Response>({
    endpoint: ENDPOINTS.{{SCREAMING_NAME}},
    method: '{{METHOD}}',
    params: {
      ...(params.limit ? { limit: params.limit } : {}),
      ...(params.skip !== undefined ? { skip: params.skip } : {}),
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
    },
    skipAuth: false,
  });
};
