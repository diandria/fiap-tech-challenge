import { buildSwaggerSpec } from '../../../../src/frameworks/http/swagger/setup';

type Operation = { security?: Array<Record<string, string[]>> };
type Spec = { paths: Record<string, Record<string, Operation>> };

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// The only documented route that takes no token. /health and /ready are public
// too, but they are not part of the spec.
const PUBLIC_OPERATIONS = ['POST /auth/login'];

function documentedOperations(spec: Spec): Array<{ key: string; operation: Operation }> {
  return Object.entries(spec.paths).flatMap(([path, operations]) =>
    Object.entries(operations)
      .filter(([method]) => HTTP_METHODS.includes(method))
      .map(([method, operation]) => ({ key: `${method.toUpperCase()} ${path}`, operation })),
  );
}

describe('swagger spec', () => {
  const spec = buildSwaggerSpec() as Spec;

  it('should declare a token on every operation that requires one', () => {
    const withoutToken = documentedOperations(spec)
      .filter(({ key }) => !PUBLIC_OPERATIONS.includes(key))
      .filter(({ operation }) => !operation.security || operation.security.length === 0)
      .map(({ key }) => key);

    expect(withoutToken).toEqual([]);
  });

  it('should ask for the staff token to list services', () => {
    expect(spec.paths['/services'].get.security).toEqual([{ bearerAuth: [] }]);
  });
});
