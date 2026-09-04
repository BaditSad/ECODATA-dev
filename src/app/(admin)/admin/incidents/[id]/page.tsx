import { redirect } from "next/navigation";

export default function IncidentRedirect({ params }: { params: { id: string } }) {
  redirect(`/admin/incidents?open=${params.id}`);
}
