'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

export async function refreshPath(path, type = 'page') {
  revalidatePath(path, type);
}

export async function refreshTag(tag) {
  revalidateTag(tag);
}

export async function handleOccupancyChange(jobId) {
  revalidatePath('/jobs/my-postings', 'page');
  revalidatePath('/mservices', 'page');
  if (jobId) {
    revalidatePath(`/mservices/opportunity/${jobId}`, 'page');
    revalidatePath(`/jobs/my-postings/${jobId}/applicants`, 'page');
  }
}
