/**
 * The shape every Server Action in the ERP returns.
 *
 * Actions answer rather than throw, so a refusal renders next to the control
 * that caused it instead of replacing the page with an error boundary. Kept
 * out of any `"use server"` file on purpose: those may only export async
 * functions, so a type declared beside them could not be imported.
 */
export interface ActionResult<T = undefined> {
  ok: boolean;
  message: string;
  data?: T;
}
