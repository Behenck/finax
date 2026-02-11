import { postAuthVerifyOtp, type PostAuthVerifyOtp200 } from "../generated";

interface verifyOTPProps {
  email: string
  code: string
}

export async function verifyOTP({ email, code }: verifyOTPProps): Promise<PostAuthVerifyOtp200> {
  const data = await postAuthVerifyOtp({ email, code });

  return data
}
