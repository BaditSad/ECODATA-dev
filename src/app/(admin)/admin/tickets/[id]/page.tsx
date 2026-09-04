import { redirect } from "next/navigation";

export default function WorkTicketRedirect({ params }: { params: { id: string } }) {
  redirect(`/admin/tickets?open=${params.id}`);
}
