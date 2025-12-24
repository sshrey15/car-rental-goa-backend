import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const client = twilio(accountSid, authToken);

// Send OTP to phone number
export const sendOTP = async (phoneNumber) => {
    try {
        // Format phone number (ensure it has country code)
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
        
        const verification = await client.verify.v2
            .services(verifyServiceSid)
            .verifications.create({
                to: formattedPhone,
                channel: 'sms'
            });
        
        return { success: true, status: verification.status };
    } catch (error) {
        console.error('Twilio sendOTP error:', error.message);
        return { success: false, message: error.message };
    }
};

// Verify OTP
export const verifyOTP = async (phoneNumber, code) => {
    try {
        // Format phone number (ensure it has country code)
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
        
        const verificationCheck = await client.verify.v2
            .services(verifyServiceSid)
            .verificationChecks.create({
                to: formattedPhone,
                code: code
            });
        
        return { 
            success: verificationCheck.status === 'approved', 
            status: verificationCheck.status 
        };
    } catch (error) {
        console.error('Twilio verifyOTP error:', error.message);
        return { success: false, message: error.message };
    }
};

export default client;
