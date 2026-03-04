import { postAuthSendEmailOtp } from "../generated";

export async function sendEmailOTP(email: string) {
  await postAuthSendEmailOtp({
    data: {
      email,
    },
  });
}
