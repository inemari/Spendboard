import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // is_admin() reads auth.jwt() under the caller's own session — never trust
  // a client-supplied "am I admin" flag for a route this powerful.
  const { data: isAdmin, error: adminCheckError } = await supabase.rpc("is_admin");
  if (adminCheckError || !isAdmin) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { email, password } = await request.json();
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ error: "Provide an email." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "Provide a password of at least 6 characters." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Best-effort: seed the new account with every admin rule template. A
  // failed template must never block account creation itself, so these run
  // under the caller's own (already admin-checked) session and swallow their
  // own errors.
  if (data.user?.id) {
    const targetUserId = data.user.id;
    const { data: templates } = await supabase.from("rule_templates").select("id");

    // Apply sequentially so two templates that target the same new category
    // cannot race each other while find-or-creating it.
    for (const template of templates ?? []) {
      await supabase.rpc("apply_rule_template", {
        p_template_id: template.id,
        target_user_id: targetUserId,
      });
    }
  }

  return NextResponse.json({ id: data.user?.id, email: data.user?.email });
}
