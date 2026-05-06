'use client';
import { LayoutGrid, Anchor, Ship, Shield, Globe } from 'lucide-react';

export default function ServicesFeed() {
  const services = [
    {
      id: 1,
      title: "Vessel Chartering",
      description: "Global chartering services for bulk, container, and specialized vessels.",
      icon: Ship,
      category: "Operations"
    },
    {
      id: 2,
      title: "Maritime Legal Support",
      description: "Expert legal advice for maritime contracts, disputes, and compliance.",
      icon: Shield,
      category: "Legal"
    },
    {
      id: 3,
      title: "Port Agency Services",
      description: "Comprehensive port agency and logistics coordination worldwide.",
      icon: Anchor,
      category: "Logistics"
    },
    {
      id: 4,
      title: "Technical Management",
      description: "Full technical management and maintenance programs for diverse fleets.",
      icon: Globe,
      category: "Management"
    }
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="card p-6 mb-2">
        <h2 className="text-xl font-bold text-[#004173] mb-2">MServices</h2>
        <p className="text-sm text-[#42474f]">Discover professional maritime services tailored to your operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <div key={service.id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#f0f7ff] flex items-center justify-center text-[#004173] flex-shrink-0">
                  <Icon size={24} />
                </div>
                <div className="flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#004173] mb-1 block">
                    {service.category}
                  </span>
                  <h3 className="font-bold text-base text-[#1b1c1c] mb-1">{service.title}</h3>
                  <p className="text-xs text-[#42474f] line-clamp-2">{service.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
