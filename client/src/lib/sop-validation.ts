import { z } from 'zod';

// SOP-compliant validation schema based on the business rules
export const sopInteractionSchema = z.object({
  // Required fields as per SOP
  prospectName: z.string().min(1, 'Constituent name is required'),
  contactLevel: z.string().min(1, 'Contact level is required'),
  method: z.string().min(1, 'Contact method is required'),
  summary: z.string().min(1, 'Summary is required'),
  status: z.string().min(1, 'Status is required'),
  actualDate: z.string().min(1, 'Actual date is required'),
  owner: z.string().min(1, 'Owner is required'),
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().min(1, 'Subcategory is required'),
  
  // Optional fields
  comments: z.string().optional(),
  affinityTags: z.array(z.string()).optional(),
  
  // Additional validation
  expectedDate: z.string().optional(),
}).refine((data) => {
  // Business rule: If status is "Pending", expected date is required
  if (data.status === 'Pending' && !data.expectedDate) {
    return false;
  }
  return true;
}, {
  message: "Expected date is required when status is 'Pending'",
  path: ['expectedDate']
}).refine((data) => {
  // Business rule: Actual date should not be in the future for completed interactions
  if (data.status === 'Complete') {
    const actualDate = new Date(data.actualDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    if (actualDate > today) {
      return false;
    }
  }
  return true;
}, {
  message: "Actual date cannot be in the future for completed interactions",
  path: ['actualDate']
});

export interface SOPValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSOPCompliance(interactionData: any): SOPValidationResult {
  const result: SOPValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    sopInteractionSchema.parse(interactionData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      result.isValid = false;
      result.errors = error.errors.map(err => err.message);
    }
  }

  // Additional SOP-specific warnings
  if (interactionData.actualDate) {
    const interactionDate = new Date(interactionData.actualDate);
    const now = new Date();
    const hoursDiff = (now.getTime() - interactionDate.getTime()) / (1000 * 60 * 60);
    
    // 48-hour entry requirement warning
    if (hoursDiff > 48) {
      result.warnings.push(
        'This interaction is being entered more than 48 hours after it occurred. Per SOP requirements, interactions should be entered within 48 hours.'
      );
    }
  }

  // Check for potentially sensitive information in comments
  if (interactionData.comments) {
    const sensitivePatterns = [
      /\b(divorced?|separation|marital|relationship status)\b/i,
      /\b(health|medical|illness|disease|disability)\b/i,
      /\b(political|democrat|republican|liberal|conservative)\b/i,
      /\b(religion|religious|church|faith|belief)\b/i,
      /\b(sexual orientation|gay|lesbian|lgbt)\b/i,
      /\b(criminal|conviction|arrest|legal trouble)\b/i,
      /\b(racial|ethnic|race|ethnicity)\b/i,
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(interactionData.comments)) {
        result.warnings.push(
          'Comments may contain sensitive information. Please review for compliance with privacy guidelines per SOP requirements.'
        );
        break;
      }
    }
  }

  // Validate that interaction is linked to a prospect plan for cultivation/solicitation/stewardship
  if (['Cultivation', 'Solicitation', 'Stewardship'].includes(interactionData.category)) {
    if (!interactionData.prospectPlanId) {
      result.warnings.push(
        'Per SOP requirements, interactions regarding cultivation, solicitation, or stewardship must be connected to an active Prospect Plan.'
      );
    }
  }

  return result;
}

export function getSOPFieldRequirements() {
  return {
    required: [
      'prospectName',
      'contactLevel',
      'method',
      'summary',
      'status',
      'actualDate',
      'owner',
      'category',
      'subcategory'
    ],
    conditional: [
      {
        field: 'expectedDate',
        condition: 'status === "Pending"',
        message: 'Expected date is required when status is Pending'
      }
    ],
    businessRules: [
      'All interactions must be entered within 48 hours of occurrence',
      'Major gift prospect interactions must be entered within 48 hours',
      'All cultivation, solicitation, and stewardship interactions must be linked to a Prospect Plan',
      'Sensitive information (health, politics, religion, etc.) must not be included in comments',
      'Interactions must document communications, not substitute for research'
    ]
  };
}

export function validateInteractionDeadline(actualDate: string): {
  isWithinDeadline: boolean;
  hoursOverdue: number;
  message: string;
} {
  const interactionDate = new Date(actualDate);
  const now = new Date();
  const hoursDiff = (now.getTime() - interactionDate.getTime()) / (1000 * 60 * 60);

  return {
    isWithinDeadline: hoursDiff <= 48,
    hoursOverdue: Math.max(0, hoursDiff - 48),
    message: hoursDiff <= 48 
      ? 'Interaction is within the 48-hour entry deadline'
      : `Interaction is ${Math.round(hoursDiff - 48)} hours past the 48-hour entry deadline`
  };
}
