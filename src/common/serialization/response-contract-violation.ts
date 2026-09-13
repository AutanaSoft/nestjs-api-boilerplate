/** Represents an internal response-schema validation or transformation failure. */
export class ResponseContractViolation extends Error {
  constructor(options?: ErrorOptions) {
    super(undefined, options);
  }
}
