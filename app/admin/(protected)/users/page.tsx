import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/admin-operations";
import { adminDate } from "@/lib/admin-format";
import { AdminHeading, AdminNotice, AdminTable, StateBadge } from "@/components/admin-ui";
import { UserCreateForm, UserAccessForm, UserPasswordForm } from "@/components/admin-record-forms";
import { AdminAccountEditor } from "@/components/admin-account-editor";

export default async function UsersPage() {
  const actor = await requireStoreAdmin();
  if (actor.role !== "ADMIN") return <main className="p-8"><AdminHeading title="Users & Roles" description="Internal account access management." /><AdminNotice>Only an administrator can view and change staff access. Managers can use the store operations and content sections.</AdminNotice></main>;
  const users = await prisma.user.findMany({ select: { ...publicUserSelect, loginId: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Users & Roles" description="Create internal accounts and manage role assignments. Passwords and password hashes are never shown." /><AdminNotice>ADMIN: store operations and user access. MANAGER: store operations and content, without user administration. STAFF, SUPPLIER and CUSTOMER have no access to this admin panel. Supplier accounts also need an approved direct-supplier contact assignment. Customer checkout contacts are listed separately under Customers.</AdminNotice><UserCreateForm /><AdminTable columns={["Name", "Email", "Role", "Status", "Created", "Access"]} empty="No user records.">{users.map((user) => <tr key={user.id}><td className="font-semibold">{user.fullName}</td><td>{user.email}</td><td><StateBadge value={user.role} /></td><td><StateBadge value={user.isActive ? "ACTIVE" : "INACTIVE"} /></td><td>{adminDate(user.createdAt)}</td><td><div className="space-y-3">{actor.id === user.id ? <AdminAccountEditor user={{ fullName: user.fullName, email: user.email, loginId: user.loginId }} /> : <UserAccessForm user={{ id: user.id, role: user.role, isActive: user.isActive }} self={false} />}<UserPasswordForm user={{ id: user.id, role: user.role, isActive: user.isActive }} /></div></td></tr>)}</AdminTable></main>;
}
