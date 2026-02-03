// Declaration bridge so imports from "@sap/cds" resolve to @cap-js/cds-types
import * as cds from "@cap-js/cds-types";

declare module "@sap/cds" {
  const _default: typeof cds;
  export default _default;
  export type Request = any;
  export const service: any;
  export type Service = any;
  export function type(...args: any[]): any;
  export * from "@cap-js/cds-types";
}

declare const SELECT: any;
declare const UPDATE: any;
