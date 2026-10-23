// SAMPLE data - copy this file to src/data.ts and put YOUR OWN details there.
// src/data.ts is git-ignored, so your personal details are never committed.
//
// Your answers for the form. Change values here; selectors live in main.ts.
// Dropdown values must match the option text on the site exactly (e.g. "Mr", "Vietnam").
// Dates use the site's format, e.g. "1 January, 2000". "" leaves a field empty.

export const applicant = {
  // Country tile to click on the /WorkingHoliday/ page, as shown there (e.g. "VIETNAM", "UNITED KINGDOM").
  // It must show OPEN, otherwise the script stops.
  country: "THAILAND",

  personal: {
    familyName: "NGUYEN",
    givenName1: "VAN A",
    title: "Mr",
    otherTitle: "",
    gender: "Male",
    dateOfBirth: "1 January, 2000",
    countryOfBirth: "Vietnam",
  },

  address: {
    address1: "1 Example Street",
    suburb: "Example Ward",
    city: "Ho Chi Minh City",
    provinceState: "Ho Chi Minh",
    postalCode: "700000",
    country: "Vietnam",
  },

  contact: {
    phoneDay: "",
    phoneNight: "",
    phoneMobile: "0900000000",
    fax: "",
    email: "you@example.com",
    representedByAgent: "No",
    communicationMethod: "Email",
    hasCreditCard: "Yes",
  },

  identification: {
    passportNumber: "C0000000",
    passportExpiry: "1 January, 2030",
    otherIdentification: "Driver License",
    otherIssueDate: "1 January, 2025",
    otherExpiryDate: "1 January, 2030",
  },

  occupation: {
    industryCode: "K732100", // Banks
    occupationCode: "261314", // Software Tester
  },

  // Answer these truthfully yourself - the script just copies them into the form
  medical: {
    renalDialysis: "No",
    tuberculosis: "No",
    cancer: "No",
    heartDisease: "No",
    disability: "No",
    hospitalisation: "No",
    residentialCare: "No",
    tbRisk: "No",
  },

  character: {
    imprisonment5Years: "No",
    imprisonment12Months: "No",
    deported: "No",
    charged: "No",
    convicted: "No",
    underInvestigation: "No",
    excluded: "No",
    removed: "No",
  },

  workingHoliday: {
    previousWhsPermitVisa: "No",
    sufficientFundsHoliday: "Yes",
    beenToNz: "No",
    sufficientFundsOnwardTicket: "Yes",
    readRequirements: "Yes",
    intendedTravelDate: "1 March, 2027",
  },
};
