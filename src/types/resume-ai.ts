export interface ResumeData {
  required: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    jobRole: string;
    company: string;
    skills: string[];
    areasOfInterest: string[];
  };

  optional: {
    education: string[];
    priorExperience: string[];
    certifications: string[];
    otherInformation: string[];
  };
}
