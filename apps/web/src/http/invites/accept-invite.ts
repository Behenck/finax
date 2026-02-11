import { postInvitesInviteidAccept } from "../generated";

export interface AcceptInviteProps {
  inviteId: string,
  data: {
    name?: string,
    email: string,
    password?: string
  }
}

export async function acceptInvite({ inviteId, data }: AcceptInviteProps) {
  await postInvitesInviteidAccept(inviteId, data);
}
