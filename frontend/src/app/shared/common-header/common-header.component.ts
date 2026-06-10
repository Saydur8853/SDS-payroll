import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Inject, OnDestroy, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { Announcement } from '../../models/announcement.model';
import { AnnouncementService } from '../../services/announcement.service';

interface FontOption {
  label: string;
  value: string;
  stack: string;
}

interface ThemeOption {
  label: string;
  value: 'dark' | 'light' | 'system';
  icon: string;
}

interface ManualSection {
  heading: string;
  items: string[];
}

interface PageManual {
  title: string;
  subtitle: string;
  icon: string;
  sections: ManualSection[];
}

@Component({
  selector: 'app-common-header',
  imports: [CommonModule],
  templateUrl: './common-header.component.html',
  styleUrl: './common-header.component.scss'
})
export class CommonHeaderComponent implements OnInit, OnDestroy {
  private readonly lastSeenStorageKey = 'sds-payroll-announcements-last-seen';
  private readonly englishFontStorageKey = 'sds-payroll-english-font';
  private readonly banglaFontStorageKey = 'sds-payroll-bangla-font';
  private readonly themeStorageKey = 'sds-payroll-theme';
  private announcementSubscription?: Subscription;
  private routerSubscription?: Subscription;

  announcements: Announcement[] = [];
  hasUnseenAnnouncements = false;
  isAnnouncementMenuOpen = false;
  isAnnouncementListExpanded = false;
  isAccessibilityMenuOpen = false;
  isInfoMenuOpen = false;
  accessibilityView: 'main' | 'font' | 'theme' = 'main';
  selectedEnglishFont = 'inter';
  selectedBanglaFont = 'noto-bengali';
  selectedTheme: ThemeOption['value'] = 'system';
  currentManual: PageManual;
  currentBanglaManual: PageManual;

  private readonly defaultManual: PageManual = {
    title: 'Page User Manual',
    subtitle: 'Quick guide for the current page.',
    icon: 'help',
    sections: [
      {
        heading: 'How to Use',
        items: [
          'Use the left menu to open a module.',
          'Use page buttons to add, update, export, or filter records.',
          'Press Esc to close open header menus.'
        ]
      }
    ]
  };

  private readonly defaultBanglaManual: PageManual = {
    title: 'পেজ ব্যবহার নির্দেশিকা',
    subtitle: 'বর্তমান পেজ ব্যবহারের দ্রুত নির্দেশনা।',
    icon: 'help',
    sections: [
      {
        heading: 'কীভাবে ব্যবহার করবেন',
        items: [
          'মডিউল খুলতে বাম পাশের মেনু ব্যবহার করুন।',
          'রেকর্ড যোগ, আপডেট, এক্সপোর্ট বা ফিল্টার করতে পেজের বাটন ব্যবহার করুন।',
          'খোলা হেডার মেনু বন্ধ করতে Esc চাপুন।'
        ]
      }
    ]
  };

  private readonly manualByPath: Record<string, PageManual> = {
    dashboard: {
      title: 'Dashboard Manual',
      subtitle: 'Overview of company, employee, attendance, and setup totals.',
      icon: 'dashboard',
      sections: [
        {
          heading: 'Overview Cards',
          items: [
            'Review total companies, employees, departments, shifts, authorizers, and attendance punches.',
            'Use the date badge to confirm which day the dashboard summary represents.'
          ]
        },
        {
          heading: 'Quick Actions',
          items: [
            'Open each management page directly from the quick action shortcuts.',
            'Use Dashboard when you need a high-level system status before working in modules.'
          ]
        }
      ]
    },
    'employee-info': {
      title: 'Employee Info Manual',
      subtitle: 'Add employees, search records, filter lists, and manage imports or exports.',
      icon: 'groups',
      sections: [
        {
          heading: 'Add Employee',
          items: [
            'Fill required fields marked with a red asterisk before saving.',
            'Upload photo and signature from the upload buttons beside the basic information section.',
            'Use dropdown fields for company, department, designation, status, gender, religion, and other employee attributes.'
          ]
        },
        {
          heading: 'Search and Filter',
          items: [
            'Choose a search type, type in Search and filter, then press Apply.',
            'Open the filter button to use advanced employee filters.',
            'Press Esc after a search to reset the search and filter state.'
          ]
        },
        {
          heading: 'CSV and Paging',
          items: [
            'Use Save as CSV to export the current employee list.',
            'Use Update by CSV to upload employee updates in bulk.',
            'Change Per Page from the page navigation area, not from the filter drawer.'
          ]
        }
      ]
    },
    attendance: {
      title: 'Attendance Manual',
      subtitle: 'Load, upload, and review employee attendance data.',
      icon: 'fact_check',
      sections: [
        {
          heading: 'Common Parameters',
          items: [
            'Select the required company, date, or shared attendance parameters before loading data.',
            'Use Apply after changing parameters so the attendance list refreshes correctly.'
          ]
        },
        {
          heading: 'Upload Attendance',
          items: [
            'Use the upload panel to import attendance files.',
            'Confirm the selected file and parameters before processing an upload.'
          ]
        },
        {
          heading: 'Review Data',
          items: [
            'Use search and filters to narrow attendance records.',
            'Check imported records before using them for payroll processing.'
          ]
        }
      ]
    },
    announcements: {
      title: 'Announcements Manual',
      subtitle: 'Create announcement posts and control what appears in the header bulletin.',
      icon: 'campaign',
      sections: [
        {
          heading: 'Post Announcement',
          items: [
            'Enter a title and message, then click Post Announcement.',
            'Enable Visible in announcement menu when the post should scroll in the header bulletin.'
          ]
        },
        {
          heading: 'Header Announcement Button',
          items: [
            'The announcement button shows the latest announcements, newest first.',
            'A blinking red dot means there are unseen announcements.',
            'Use More inside the dropdown to reveal older posts when available.'
          ]
        },
        {
          heading: 'Manage Posts',
          items: [
            'Use Edit to update an announcement.',
            'Use Delete to remove an announcement from the system.'
          ]
        }
      ]
    },
    'company-info': {
      title: 'Company Info Manual',
      subtitle: 'Manage company profile records and related configuration.',
      icon: 'business',
      sections: [
        {
          heading: 'Company Records',
          items: [
            'Add company details carefully because other modules depend on company selection.',
            'Update company information when organization details change.'
          ]
        },
        {
          heading: 'Usage Notes',
          items: [
            'Departments, designations, employees, salary rules, and attendance are linked to company data.',
            'Avoid deleting a company that already has dependent records unless the system allows it safely.'
          ]
        }
      ]
    },
    departments: {
      title: 'Departments Manual',
      subtitle: 'Create and manage department records.',
      icon: 'account_tree',
      sections: [
        {
          heading: 'Department Setup',
          items: [
            'Create departments under the correct company.',
            'Use meaningful department names so employee filtering and reporting remain clear.'
          ]
        },
        {
          heading: 'Maintenance',
          items: [
            'Edit a department when naming or configuration changes are needed.',
            'Check linked employees before deleting a department.'
          ]
        }
      ]
    },
    designations: {
      title: 'Designations Manual',
      subtitle: 'Manage employee designation records.',
      icon: 'workspace_premium',
      sections: [
        {
          heading: 'Designation Setup',
          items: [
            'Create designations that match job roles used by HR and payroll.',
            'Assign designations during employee creation or update.'
          ]
        },
        {
          heading: 'Maintenance',
          items: [
            'Edit designation names when organization role titles change.',
            'Review employees linked to a designation before deletion.'
          ]
        }
      ]
    },
    'salary-rules': {
      title: 'Salary Rules Manual',
      subtitle: 'Configure payroll salary rule definitions.',
      icon: 'payments',
      sections: [
        {
          heading: 'Rule Setup',
          items: [
            'Create salary rules that match company payroll policies.',
            'Assign the correct salary rule to employees in Employee Info.'
          ]
        },
        {
          heading: 'Maintenance',
          items: [
            'Update rules only after confirming payroll impact.',
            'Avoid deleting rules that are already assigned to active employees.'
          ]
        }
      ]
    },
    'report-templates': {
      title: 'Report Templates Manual',
      subtitle: 'Design printable report templates without code changes.',
      icon: 'dashboard_customize',
      sections: [
        {
          heading: 'Employee Info Template',
          items: [
            'Choose the report title, subtitle, page orientation, and layout.',
            'Enable photo or signature when the PDF should include employee media.',
            'Select fields and reorder them to control the print/PDF output.'
          ]
        },
        {
          heading: 'Apply Template',
          items: [
            'Click Save Template after changing the design.',
            'Go to Employee Info and click Print / Save PDF to use the saved template.',
            'Use Reset Default when you want to return to the standard employee report.'
          ]
        }
      ]
    },
    shifts: {
      title: 'Shift Info Manual',
      subtitle: 'Create and maintain working shift definitions.',
      icon: 'schedule',
      sections: [
        {
          heading: 'Shift Setup',
          items: [
            'Define shift timing based on actual working schedules.',
            'Use active shift records when assigning employees.'
          ]
        },
        {
          heading: 'Attendance Impact',
          items: [
            'Shift timing affects attendance interpretation and payroll calculations.',
            'Review shift changes before applying them to many employees.'
          ]
        }
      ]
    },
    authorizers: {
      title: 'Authorizers Manual',
      subtitle: 'Manage people who authorize HR or payroll actions.',
      icon: 'verified_user',
      sections: [
        {
          heading: 'Authorizer Setup',
          items: [
            'Create authorizers with accurate personal and employment details.',
            'Upload photo and signature where required for official documents.'
          ]
        },
        {
          heading: 'Access Usage',
          items: [
            'Keep authorizer status accurate so inactive people are not used for approvals.',
            'Review department and designation links before saving.'
          ]
        }
      ]
    }
  };

  private readonly banglaManualByPath: Record<string, PageManual> = {
    dashboard: {
      title: 'ড্যাশবোর্ড ম্যানুয়াল',
      subtitle: 'কোম্পানি, কর্মচারী, উপস্থিতি এবং সেটআপের সারসংক্ষেপ দেখুন।',
      icon: 'dashboard',
      sections: [
        {
          heading: 'ওভারভিউ কার্ড',
          items: [
            'মোট কোম্পানি, কর্মচারী, ডিপার্টমেন্ট, শিফট, অথরাইজার এবং উপস্থিতি পাঞ্চ দেখুন।',
            'ড্যাশবোর্ডের তথ্য কোন তারিখের তা নিশ্চিত করতে ডেট ব্যাজ দেখুন।'
          ]
        },
        {
          heading: 'দ্রুত কাজ',
          items: [
            'কুইক অ্যাকশন শর্টকাট থেকে সরাসরি প্রয়োজনীয় ম্যানেজমেন্ট পেজ খুলুন।',
            'অন্য মডিউলে কাজ করার আগে সিস্টেমের সারসংক্ষেপ দেখতে ড্যাশবোর্ড ব্যবহার করুন।'
          ]
        }
      ]
    },
    'employee-info': {
      title: 'কর্মচারী তথ্য ম্যানুয়াল',
      subtitle: 'কর্মচারী যোগ, সার্চ, ফিল্টার, ইমপোর্ট এবং এক্সপোর্ট পরিচালনা করুন।',
      icon: 'groups',
      sections: [
        {
          heading: 'কর্মচারী যোগ করুন',
          items: [
            'সেভ করার আগে লাল তারকা চিহ্ন দেওয়া বাধ্যতামূলক ফিল্ড পূরণ করুন।',
            'Basic Information অংশের পাশের আপলোড বাটন থেকে ছবি এবং স্বাক্ষর আপলোড করুন।',
            'Company, Department, Designation, Status, Gender, Religion এবং অন্যান্য অ্যাট্রিবিউট ড্রপডাউন থেকে নির্বাচন করুন।'
          ]
        },
        {
          heading: 'সার্চ এবং ফিল্টার',
          items: [
            'সার্চ টাইপ নির্বাচন করে Search and filter ফিল্ডে লিখুন, তারপর Apply চাপুন।',
            'অ্যাডভান্সড ফিল্টারের জন্য ফিল্টার বাটন খুলুন।',
            'সার্চের পর Esc চাপলে সার্চ এবং ফিল্টার রিসেট হবে।'
          ]
        },
        {
          heading: 'CSV এবং পেজিং',
          items: [
            'বর্তমান কর্মচারী তালিকা এক্সপোর্ট করতে Save as CSV ব্যবহার করুন।',
            'বাল্ক আপডেটের জন্য Update by CSV ব্যবহার করুন।',
            'Per Page ফিল্টার ড্রয়ারে নয়, পেজ নেভিগেশন এরিয়া থেকে পরিবর্তন করুন।'
          ]
        }
      ]
    },
    attendance: {
      title: 'উপস্থিতি ম্যানুয়াল',
      subtitle: 'কর্মচারীদের উপস্থিতি ডাটা লোড, আপলোড এবং যাচাই করুন।',
      icon: 'fact_check',
      sections: [
        {
          heading: 'কমন প্যারামিটার',
          items: [
            'ডাটা লোড করার আগে প্রয়োজনীয় কোম্পানি, তারিখ বা উপস্থিতি প্যারামিটার নির্বাচন করুন।',
            'প্যারামিটার পরিবর্তনের পর Apply চাপুন যাতে উপস্থিতি তালিকা সঠিকভাবে রিফ্রেশ হয়।'
          ]
        },
        {
          heading: 'উপস্থিতি আপলোড',
          items: [
            'Attendance ফাইল ইমপোর্ট করতে upload panel ব্যবহার করুন।',
            'আপলোড প্রসেস করার আগে নির্বাচিত ফাইল এবং প্যারামিটার যাচাই করুন।'
          ]
        },
        {
          heading: 'ডাটা যাচাই',
          items: [
            'উপস্থিতি রেকর্ড ছোট করতে সার্চ এবং ফিল্টার ব্যবহার করুন।',
            'পে-রোল প্রসেসিংয়ের আগে ইমপোর্ট করা রেকর্ড যাচাই করুন।'
          ]
        }
      ]
    },
    announcements: {
      title: 'ঘোষণা ম্যানুয়াল',
      subtitle: 'ঘোষণা পোস্ট তৈরি করুন এবং হেডার বুলেটিনে কী দেখাবে তা নিয়ন্ত্রণ করুন।',
      icon: 'campaign',
      sections: [
        {
          heading: 'ঘোষণা পোস্ট',
          items: [
            'Title এবং Message লিখে Post Announcement চাপুন।',
            'পোস্টটি হেডার বুলেটিনে দেখাতে Visible in announcement menu চালু করুন।'
          ]
        },
        {
          heading: 'হেডার ঘোষণা বাটন',
          items: [
            'ঘোষণা বাটনে সর্বশেষ ঘোষণা আগে দেখায়।',
            'লাল ব্লিংকিং ডট মানে নতুন অদেখা ঘোষণা আছে।',
            'আরও পুরোনো পোস্ট দেখতে dropdown এর More ব্যবহার করুন।'
          ]
        },
        {
          heading: 'পোস্ট ম্যানেজ',
          items: [
            'ঘোষণা আপডেট করতে Edit ব্যবহার করুন।',
            'সিস্টেম থেকে ঘোষণা সরাতে Delete ব্যবহার করুন।'
          ]
        }
      ]
    },
    'company-info': {
      title: 'কোম্পানি তথ্য ম্যানুয়াল',
      subtitle: 'কোম্পানি প্রোফাইল এবং সংশ্লিষ্ট কনফিগারেশন পরিচালনা করুন।',
      icon: 'business',
      sections: [
        {
          heading: 'কোম্পানি রেকর্ড',
          items: [
            'কোম্পানি তথ্য সতর্কভাবে যোগ করুন, কারণ অন্য মডিউল কোম্পানি নির্বাচনের উপর নির্ভর করে।',
            'প্রতিষ্ঠানের তথ্য পরিবর্তন হলে কোম্পানি তথ্য আপডেট করুন।'
          ]
        },
        {
          heading: 'ব্যবহার নোট',
          items: [
            'Departments, Designations, Employees, Salary Rules এবং Attendance কোম্পানি ডাটার সাথে যুক্ত।',
            'ডিপেন্ডেন্ট রেকর্ড থাকলে নিরাপদভাবে অনুমতি না পাওয়া পর্যন্ত কোম্পানি ডিলিট করবেন না।'
          ]
        }
      ]
    },
    departments: {
      title: 'ডিপার্টমেন্ট ম্যানুয়াল',
      subtitle: 'ডিপার্টমেন্ট রেকর্ড তৈরি এবং পরিচালনা করুন।',
      icon: 'account_tree',
      sections: [
        {
          heading: 'ডিপার্টমেন্ট সেটআপ',
          items: [
            'সঠিক কোম্পানির অধীনে ডিপার্টমেন্ট তৈরি করুন।',
            'ফিল্টার এবং রিপোর্টিং পরিষ্কার রাখতে অর্থপূর্ণ ডিপার্টমেন্ট নাম ব্যবহার করুন।'
          ]
        },
        {
          heading: 'রক্ষণাবেক্ষণ',
          items: [
            'নাম বা কনফিগারেশন পরিবর্তনের প্রয়োজন হলে ডিপার্টমেন্ট Edit করুন।',
            'ডিপার্টমেন্ট ডিলিট করার আগে লিঙ্কড কর্মচারী যাচাই করুন।'
          ]
        }
      ]
    },
    designations: {
      title: 'ডেজিগনেশন ম্যানুয়াল',
      subtitle: 'কর্মচারীদের পদবী রেকর্ড পরিচালনা করুন।',
      icon: 'workspace_premium',
      sections: [
        {
          heading: 'ডেজিগনেশন সেটআপ',
          items: [
            'HR এবং Payroll-এ ব্যবহৃত চাকরির ভূমিকার সাথে মিল রেখে ডেজিগনেশন তৈরি করুন।',
            'কর্মচারী তৈরি বা আপডেট করার সময় সঠিক ডেজিগনেশন নির্বাচন করুন।'
          ]
        },
        {
          heading: 'রক্ষণাবেক্ষণ',
          items: [
            'প্রতিষ্ঠানের ভূমিকা পরিবর্তন হলে ডেজিগনেশন নাম আপডেট করুন।',
            'ডেজিগনেশন ডিলিট করার আগে লিঙ্কড কর্মচারী যাচাই করুন।'
          ]
        }
      ]
    },
    'salary-rules': {
      title: 'স্যালারি রুলস ম্যানুয়াল',
      subtitle: 'পে-রোল স্যালারি রুল কনফিগার করুন।',
      icon: 'payments',
      sections: [
        {
          heading: 'রুল সেটআপ',
          items: [
            'কোম্পানির পে-রোল নীতির সাথে মিল রেখে স্যালারি রুল তৈরি করুন।',
            'Employee Info থেকে কর্মচারীর জন্য সঠিক স্যালারি রুল নির্বাচন করুন।'
          ]
        },
        {
          heading: 'রক্ষণাবেক্ষণ',
          items: [
            'পে-রোল প্রভাব নিশ্চিত করার পরেই রুল আপডেট করুন।',
            'অ্যাকটিভ কর্মচারীর সাথে যুক্ত রুল ডিলিট করা এড়িয়ে চলুন।'
          ]
        }
      ]
    },
    'report-templates': {
      title: 'রিপোর্ট টেমপ্লেট ম্যানুয়াল',
      subtitle: 'কোড পরিবর্তন ছাড়াই প্রিন্টযোগ্য রিপোর্ট টেমপ্লেট ডিজাইন করুন।',
      icon: 'dashboard_customize',
      sections: [
        {
          heading: 'কর্মচারী তথ্য টেমপ্লেট',
          items: [
            'রিপোর্টের title, subtitle, page orientation এবং layout নির্বাচন করুন।',
            'PDF-এ কর্মচারীর ছবি বা স্বাক্ষর দেখাতে photo/signature অপশন চালু করুন।',
            'প্রিন্ট/PDF আউটপুট নিয়ন্ত্রণ করতে field নির্বাচন এবং reorder করুন।'
          ]
        },
        {
          heading: 'টেমপ্লেট প্রয়োগ',
          items: [
            'ডিজাইন পরিবর্তনের পর Save Template চাপুন।',
            'Employee Info পেজে গিয়ে Print / Save PDF চাপলে সেভ করা টেমপ্লেট ব্যবহার হবে।',
            'স্ট্যান্ডার্ড রিপোর্টে ফিরতে Reset Default ব্যবহার করুন।'
          ]
        }
      ]
    },
    shifts: {
      title: 'শিফট তথ্য ম্যানুয়াল',
      subtitle: 'কাজের শিফট ডেফিনিশন তৈরি এবং রক্ষণাবেক্ষণ করুন।',
      icon: 'schedule',
      sections: [
        {
          heading: 'শিফট সেটআপ',
          items: [
            'বাস্তব কাজের সময়সূচির ভিত্তিতে শিফট টাইম নির্ধারণ করুন।',
            'কর্মচারী অ্যাসাইন করার সময় অ্যাকটিভ শিফট ব্যবহার করুন।'
          ]
        },
        {
          heading: 'উপস্থিতির প্রভাব',
          items: [
            'শিফট টাইম উপস্থিতি বিশ্লেষণ এবং পে-রোল ক্যালকুলেশনে প্রভাব ফেলে।',
            'অনেক কর্মচারীর উপর প্রয়োগ করার আগে শিফট পরিবর্তন যাচাই করুন।'
          ]
        }
      ]
    },
    authorizers: {
      title: 'অথরাইজার ম্যানুয়াল',
      subtitle: 'HR বা Payroll অ্যাকশন অনুমোদনকারী ব্যক্তিদের পরিচালনা করুন।',
      icon: 'verified_user',
      sections: [
        {
          heading: 'অথরাইজার সেটআপ',
          items: [
            'সঠিক ব্যক্তিগত এবং কর্মসংস্থান তথ্য দিয়ে অথরাইজার তৈরি করুন।',
            'অফিসিয়াল ডকুমেন্টের জন্য প্রয়োজন হলে ছবি এবং স্বাক্ষর আপলোড করুন।'
          ]
        },
        {
          heading: 'অ্যাক্সেস ব্যবহার',
          items: [
            'ইনঅ্যাকটিভ ব্যক্তির অনুমোদন ব্যবহার ঠেকাতে অথরাইজার স্ট্যাটাস সঠিক রাখুন।',
            'সেভ করার আগে Department এবং Designation লিংক যাচাই করুন।'
          ]
        }
      ]
    }
  };

  readonly englishFontOptions: FontOption[] = [
    {
      label: 'Inter',
      value: 'inter',
      stack: "'Inter'"
    },
    {
      label: 'Segoe UI',
      value: 'segoe',
      stack: "'Segoe UI'"
    },
    {
      label: 'Arial',
      value: 'arial',
      stack: 'Arial'
    },
    {
      label: 'Calibri',
      value: 'calibri',
      stack: 'Calibri'
    },
    {
      label: 'Roboto',
      value: 'roboto',
      stack: 'Roboto'
    },
    {
      label: 'Times New Roman',
      value: 'times-new-roman',
      stack: "'Times New Roman'"
    }
  ];

  readonly banglaFontOptions: FontOption[] = [
    {
      label: 'Noto Sans Bengali',
      value: 'noto-bengali',
      stack: "'Noto Sans Bengali'"
    },
    {
      label: 'SolaimanLipi',
      value: 'solaimanlipi',
      stack: 'SolaimanLipi'
    },
    {
      label: 'Kalpurush',
      value: 'kalpurush',
      stack: 'Kalpurush'
    },
    {
      label: 'SutonnyMJ',
      value: 'sutonnymj',
      stack: 'SutonnyMJ'
    },
    {
      label: 'Nikosh Bangla',
      value: 'nikosh-bangla',
      stack: "'Nikosh Bangla'"
    },
    {
      label: 'Tiro Bangla',
      value: 'tiro-bangla',
      stack: "'Tiro Bangla'"
    },
    {
      label: 'Hind Siliguri',
      value: 'hind-siliguri',
      stack: "'Hind Siliguri'"
    },
    {
      label: 'Anek Bangla',
      value: 'anek-bangla',
      stack: "'Anek Bangla'"
    }
  ];

  readonly themeOptions: ThemeOption[] = [
    {
      label: 'Dark',
      value: 'dark',
      icon: 'dark_mode'
    },
    {
      label: 'Light',
      value: 'light',
      icon: 'light_mode'
    },
    {
      label: 'System',
      value: 'system',
      icon: 'desktop_windows'
    }
  ];

  get bulletinText(): string {
    return this.visibleAnnouncements
      .map((announcement) => `${announcement.title} : ${announcement.message}`)
      .join('   |   ');
  }

  get bulletinAnimationDuration(): string {
    const textLength = this.bulletinText.length;
    const seconds = Math.min(180, Math.max(55, Math.round(textLength / 5)));
    return `${seconds}s`;
  }

  get menuAnnouncements(): Announcement[] {
    return this.isAnnouncementListExpanded ? this.announcements : this.announcements.slice(0, 10);
  }

  get visibleAnnouncements(): Announcement[] {
    return this.announcements.filter((announcement) => announcement.isActive);
  }

  get hasMoreAnnouncements(): boolean {
    return this.announcements.length > 10 && !this.isAnnouncementListExpanded;
  }

  constructor(
    private readonly announcementService: AnnouncementService,
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly router: Router,
    @Inject(DOCUMENT) private readonly documentRef: Document
  ) {
    this.currentManual = this.defaultManual;
    this.currentBanglaManual = this.defaultBanglaManual;
  }

  ngOnInit(): void {
    this.loadFontPreferences();
    this.syncManual(this.router.url);
    this.loadAnnouncements();
    this.announcementSubscription = this.announcementService.changed$.subscribe(() => {
      this.loadAnnouncements();
    });
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.syncManual(event.urlAfterRedirects);
        this.isInfoMenuOpen = false;
      });
  }

  ngOnDestroy(): void {
    this.announcementSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isAnnouncementMenuOpen && !this.isAccessibilityMenuOpen && !this.isInfoMenuOpen) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeOpenMenus();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeOpenMenus();
  }

  toggleAnnouncementMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isAnnouncementMenuOpen = !this.isAnnouncementMenuOpen;

    if (this.isAnnouncementMenuOpen) {
      this.isAccessibilityMenuOpen = false;
      this.markAnnouncementsSeen();
    } else {
      this.isAnnouncementListExpanded = false;
    }
  }

  closeAnnouncementMenu(): void {
    this.isAnnouncementMenuOpen = false;
    this.isAnnouncementListExpanded = false;
  }

  toggleAccessibilityMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isAccessibilityMenuOpen = !this.isAccessibilityMenuOpen;
    if (this.isAccessibilityMenuOpen) {
      this.closeAnnouncementMenu();
      this.isInfoMenuOpen = false;
      this.accessibilityView = 'main';
    }
  }

  toggleInfoMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isInfoMenuOpen = !this.isInfoMenuOpen;
    if (this.isInfoMenuOpen) {
      this.closeAnnouncementMenu();
      this.isAccessibilityMenuOpen = false;
      this.accessibilityView = 'main';
    }
  }

  selectEnglishFont(value: string): void {
    this.selectedEnglishFont = value;
    localStorage.setItem(this.englishFontStorageKey, value);
    this.applyFontPreferences();
  }

  selectBanglaFont(value: string): void {
    this.selectedBanglaFont = value;
    localStorage.setItem(this.banglaFontStorageKey, value);
    this.applyFontPreferences();
  }

  resetFonts(): void {
    this.selectedEnglishFont = 'inter';
    this.selectedBanglaFont = 'noto-bengali';
    localStorage.removeItem(this.englishFontStorageKey);
    localStorage.removeItem(this.banglaFontStorageKey);
    this.applyFontPreferences();
  }

  formatAnnouncementDate(value: string): string {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  private loadAnnouncements(): void {
    this.announcementService.getAll(true).subscribe({
      next: (announcements) => {
        this.announcements = announcements.sort(
          (first, second) => new Date(second.createdAtUtc).getTime() - new Date(first.createdAtUtc).getTime()
        );
        if (this.isAnnouncementMenuOpen) {
          this.markAnnouncementsSeen();
          return;
        }

        this.updateUnseenState();
      },
      error: () => {
        this.announcements = [];
        this.hasUnseenAnnouncements = false;
      }
    });
  }

  private updateUnseenState(): void {
    const latestCreatedAt = this.getLatestCreatedAt();
    if (!latestCreatedAt) {
      this.hasUnseenAnnouncements = false;
      return;
    }

    const lastSeen = localStorage.getItem(this.lastSeenStorageKey);
    const latestTime = new Date(latestCreatedAt).getTime();
    this.hasUnseenAnnouncements = !lastSeen || latestTime > new Date(lastSeen).getTime();
  }

  private markAnnouncementsSeen(): void {
    const latestCreatedAt = this.getLatestCreatedAt();
    if (latestCreatedAt) {
      localStorage.setItem(this.lastSeenStorageKey, latestCreatedAt);
    }

    this.hasUnseenAnnouncements = false;
  }

  private getLatestCreatedAt(): string | null {
    return this.announcements.reduce<string | null>((latest, announcement) => {
      if (!latest) {
        return announcement.createdAtUtc;
      }

      return new Date(announcement.createdAtUtc).getTime() > new Date(latest).getTime()
        ? announcement.createdAtUtc
        : latest;
    }, null);
  }

  showMoreAnnouncements(): void {
    this.isAnnouncementListExpanded = true;
  }

  private closeOpenMenus(): void {
    this.closeAnnouncementMenu();
    this.isAccessibilityMenuOpen = false;
    this.isInfoMenuOpen = false;
    this.accessibilityView = 'main';
  }

  private syncManual(url: string): void {
    const path = url.split('?')[0].split('#')[0].replace(/^\/+/, '') || 'dashboard';
    this.currentManual = this.manualByPath[path] ?? this.defaultManual;
    this.currentBanglaManual = this.banglaManualByPath[path] ?? this.defaultBanglaManual;
  }

  private loadFontPreferences(): void {
    const englishFont = localStorage.getItem(this.englishFontStorageKey);
    const banglaFont = localStorage.getItem(this.banglaFontStorageKey);
    const theme = localStorage.getItem(this.themeStorageKey);

    if (englishFont && this.englishFontOptions.some((option) => option.value === englishFont)) {
      this.selectedEnglishFont = englishFont;
    }

    if (banglaFont && this.banglaFontOptions.some((option) => option.value === banglaFont)) {
      this.selectedBanglaFont = banglaFont;
    }

    if (theme === 'dark' || theme === 'light' || theme === 'system') {
      this.selectedTheme = theme;
    }

    this.applyFontPreferences();
    this.applyThemePreference();
  }

  private applyFontPreferences(): void {
    const englishFont = this.englishFontOptions.find((option) => option.value === this.selectedEnglishFont) ?? this.englishFontOptions[0];
    const banglaFont = this.banglaFontOptions.find((option) => option.value === this.selectedBanglaFont) ?? this.banglaFontOptions[0];
    const root = this.documentRef.documentElement;

    root.style.setProperty('--app-english-font', englishFont.stack);
    root.style.setProperty('--app-bangla-font', banglaFont.stack);
    root.style.setProperty(
      '--app-font-family',
      `${englishFont.stack}, ${banglaFont.stack}, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
    );
  }

  openAccessibilityView(view: 'main' | 'font' | 'theme'): void {
    this.accessibilityView = view;
  }

  selectTheme(value: ThemeOption['value']): void {
    this.selectedTheme = value;
    localStorage.setItem(this.themeStorageKey, value);
    this.applyThemePreference();
  }

  private applyThemePreference(): void {
    const root = this.documentRef.documentElement;
    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
    const effectiveTheme = this.selectedTheme === 'system'
      ? prefersLight ? 'light' : 'dark'
      : this.selectedTheme;

    root.dataset['theme'] = effectiveTheme;
    root.dataset['themePreference'] = this.selectedTheme;
  }
}
