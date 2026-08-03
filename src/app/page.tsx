import { redirect } from "next/navigation";

export default function Home() {
  const now = new Date();
  redirect(`/${now.getFullYear()}/${now.getMonth() + 1}`);
}
