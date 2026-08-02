import { redirect } from "next/navigation";

/** Instructors directory removed from the public site. */
export default function TeachersRedirectPage() {
  redirect("/");
}
