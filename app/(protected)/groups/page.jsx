import SidebarLeft from '@/src/components/layout/SidebarLeft';
import SidebarRight from '@/src/components/layout/SidebarRight';
import GroupsDirectory from '@/src/components/groups/GroupsDirectory';

export default function GroupsPage() {
  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-4 overflow-hidden">
      <GroupsDirectory />
    </div>
  );
}

